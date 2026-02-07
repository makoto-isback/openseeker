/**
 * AI Router — 3-tier multi-model routing.
 *
 * Fast  (Groq/Llama 3.3 70B):     greetings, price checks, simple tasks — FREE
 * Smart (Gemini 2.0 Flash):        analysis, strategy, research — FREE (1500 req/day)
 * Backup (OpenAI/GPT-4o-mini):     fallback if others fail — $0.15/$0.60 per 1M tokens
 *
 * Fallback chains:
 *   fast:   Groq → Gemini → OpenAI
 *   smart:  Gemini → OpenAI → Groq
 *   backup: OpenAI → Gemini → Groq
 */

const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// Lazy-init clients
let groqClient = null;
let geminiClient = null;
let openaiClient = null;

function getGroq() {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) return null;
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

function getGemini() {
  if (!geminiClient) {
    if (!process.env.GEMINI_API_KEY) return null;
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return geminiClient;
}

function getOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) return null;
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const MODELS = {
  fast: { provider: 'groq', model: 'llama-3.3-70b-versatile', fallback: 'llama-3.1-8b-instant', maxTokens: 1024 },
  smart: { provider: 'gemini', model: 'gemini-2.0-flash', maxTokens: 1024 },
  backup: { provider: 'openai', model: 'gpt-4o-mini', maxTokens: 1024 },
};

// Fallback chains per complexity
const CHAINS = {
  fast:   ['groq', 'gemini', 'openai'],
  smart:  ['gemini', 'openai', 'groq'],
  backup: ['openai', 'gemini', 'groq'],
};

// ============================================================
// Classify message complexity
// ============================================================

function classifyComplexity(message, skillTag) {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (!hasGemini && !hasOpenAI) return 'fast';

  const msg = message.toLowerCase();

  // FAST: greetings & simple
  const fastPatterns = /^(gm|gn|hey|hi|yo|sup|hello|thanks|ty|ok|yes|no|sure|nah|bet|lol|lmao|nice|cool|thx)\b/;
  if (fastPatterns.test(msg.trim())) return 'fast';
  if (msg.length < 30 && !msg.includes('?') && !/should/.test(msg)) return 'fast';

  // SMART: decisions, analysis, research
  const smartPatterns = [
    /should i (buy|sell|hold|stake|swap|exit)/,
    /what do you think/,
    /analyze|analysis/,
    /strategy|recommend|suggest|advice/,
    /compare|versus|vs\b/,
    /explain|why is|how does/,
    /risk|safe|dangerous|risky/,
    /bull|bear|sentiment/,
    /research|deep dive|tell me about/,
    /fundamentals|tokenomics/,
    /pros and cons/,
    /portfolio|rebalance|allocat/,
    /emergency|exit|panic/,
    /take profit|stop loss.*should/,
    /weekly.*(recap|summary)/,
    /daily.*(recap|summary)/,
    /what.*(happened|learned|know about me)/,
    /plan|step by step/,
  ];

  const smartSkills = [
    'token_research', 'trending_tokens', 'defi_yields', 'whale_track',
    'weekly_recap', 'my_memory', 'portfolio_track', 'new_tokens', 'daily_recap',
    'swap_quote', 'limit_buy', 'limit_sell', 'dca_setup', 'stop_loss',
  ];

  for (const pattern of smartPatterns) {
    if (pattern.test(msg)) return 'smart';
  }
  if (skillTag && smartSkills.includes(skillTag)) return 'smart';
  if (msg.length > 150) return 'smart';
  if (msg.includes('?') && msg.length > 40) return 'smart';

  return 'fast';
}

// ============================================================
// Provider call functions
// ============================================================

async function callGroq(messages, maxTokens = 1024) {
  const client = getGroq();
  if (!client) throw new Error('Groq not configured');

  const model = MODELS.fast.model;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model, messages, max_tokens: maxTokens, temperature: 0.7,
      });
      return { content: response.choices[0]?.message?.content || '', model, provider: 'groq' };
    } catch (error) {
      const isDailyLimit = error.message?.includes('tokens per day') || error.message?.includes('TPD');
      if (isDailyLimit) {
        console.warn(`[AIRouter] Groq daily limit on ${model} — skipping 8b, falling through to next provider`);
        throw new Error('Groq TPD exhausted');
      }

      const isRateLimit = error.status === 429 || error.message?.includes('rate');
      if (isRateLimit && attempt < 2) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Groq unavailable');
}

async function callGemini(messages, maxTokens = 1024) {
  const client = getGemini();
  if (!client) throw new Error('Gemini not configured');

  // Convert OpenAI-format messages to Gemini format
  let systemInstruction = '';
  const history = [];
  let lastUserMessage = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
    } else if (msg.role === 'user') {
      lastUserMessage = msg.content;
      history.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      history.push({ role: 'model', parts: [{ text: msg.content }] });
    }
  }

  // Gemini requires: first message must be 'user', alternating roles
  // Remove trailing user message (we'll send it via sendMessage)
  if (history.length > 0 && history[history.length - 1].role === 'user') {
    history.pop();
  }

  // Fix: ensure history starts with 'user' if non-empty
  if (history.length > 0 && history[0].role !== 'user') {
    history.unshift({ role: 'user', parts: [{ text: '.' }] });
  }

  // Fix: merge consecutive same-role messages
  const fixedHistory = [];
  for (const entry of history) {
    if (fixedHistory.length > 0 && fixedHistory[fixedHistory.length - 1].role === entry.role) {
      fixedHistory[fixedHistory.length - 1].parts[0].text += '\n' + entry.parts[0].text;
    } else {
      fixedHistory.push({ ...entry });
    }
  }

  // Ensure alternating: if we have consecutive mismatches after merge, pad
  const padded = [];
  for (let i = 0; i < fixedHistory.length; i++) {
    if (i > 0 && fixedHistory[i].role === padded[padded.length - 1].role) {
      const filler = fixedHistory[i].role === 'user' ? 'model' : 'user';
      padded.push({ role: filler, parts: [{ text: '...' }] });
    }
    padded.push(fixedHistory[i]);
  }

  const model = client.getGenerativeModel({
    model: MODELS.smart.model,
    systemInstruction: systemInstruction || undefined,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  });

  const chatSession = model.startChat({ history: padded });
  const result = await chatSession.sendMessage(lastUserMessage || 'respond');
  const text = result.response.text();

  return { content: text || '', model: MODELS.smart.model, provider: 'gemini' };
}

async function callOpenAI(messages, maxTokens = 1024) {
  const client = getOpenAI();
  if (!client) throw new Error('OpenAI not configured');

  const response = await client.chat.completions.create({
    model: MODELS.backup.model, messages, max_tokens: maxTokens, temperature: 0.7,
  });
  return { content: response.choices[0]?.message?.content || '', model: MODELS.backup.model, provider: 'openai' };
}

// Provider dispatch map
const PROVIDERS = {
  groq: callGroq,
  gemini: callGemini,
  openai: callOpenAI,
};

// ============================================================
// Main chat function — tries fallback chain
// ============================================================

async function chat(messages, options = {}) {
  const complexity = options.forceModel ||
    classifyComplexity(options.userMessage || '', options.skillTag || '');

  const chain = CHAINS[complexity] || CHAINS.fast;
  const maxTokens = options.maxTokens || 1024;

  console.log(`[AIRouter] complexity=${complexity} | "${(options.userMessage || '').substring(0, 60)}"`);

  for (let i = 0; i < chain.length; i++) {
    const providerName = chain[i];
    const callFn = PROVIDERS[providerName];

    try {
      const result = await callFn(messages, maxTokens);
      if (i > 0) console.log(`[AIRouter] Fallback → ${result.provider}/${result.model}`);
      else console.log(`[AIRouter] ${result.provider}/${result.model}`);
      return { ...result, complexity };
    } catch (err) {
      console.warn(`[AIRouter] ${providerName} failed: ${err.message}`);
      if (i === chain.length - 1) throw new Error('AI service unavailable — all providers failed');
    }
  }

  throw new Error('AI service unavailable');
}

// ============================================================
// Fast-only call for memory extraction (cost saving)
// ============================================================

async function extractWithFastModel(messages) {
  // Try Groq first (free), then Gemini (free), then give up
  try {
    const result = await callGroq(messages, 512);
    return result.content;
  } catch {
    try {
      const result = await callGemini(messages, 512);
      return result.content;
    } catch {
      return '[]';
    }
  }
}

// ============================================================
// Status: which providers are available
// ============================================================

function getAvailableProviders() {
  return {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    models: MODELS,
    chains: CHAINS,
  };
}

module.exports = {
  chat,
  extractWithFastModel,
  classifyComplexity,
  getAvailableProviders,
  MODELS,
};
