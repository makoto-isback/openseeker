/**
 * AI Router — Multi-model routing with automatic complexity classification.
 *
 * Fast (Groq/Llama): simple tasks, price checks, greetings, confirmations
 * Smart (OpenAI/GPT-4o-mini): analysis, strategy, research, complex decisions
 *
 * Falls back to Groq if OpenAI is unavailable.
 */

const Groq = require('groq-sdk');
const OpenAI = require('openai');

// Lazy-init clients
let groq = null;
let openai = null;

function getGroq() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set');
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) return null;
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const MODELS = {
  fast: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    fallback: 'llama-3.1-8b-instant',
    maxTokens: 1024,
  },
  smart: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 1024,
  },
};

// ============================================================
// Classify message complexity
// ============================================================

function classifyComplexity(message, skillTag) {
  if (!process.env.OPENAI_API_KEY) return 'fast';

  const msg = message.toLowerCase();

  const smartPatterns = [
    /should i (buy|sell|hold|stake|swap|exit)/,
    /what do you think/,
    /analyze|analysis/,
    /strategy|recommend|suggest|advice/,
    /compare|versus|vs\b/,
    /explain|why is|how does/,
    /risk|safe|dangerous/,
    /bull|bear|sentiment/,
    /research|deep dive|tell me about/,
    /fundamentals|tokenomics/,
    /pros and cons/,
    /portfolio|rebalance|allocat/,
    /emergency|exit|panic/,
    /take profit|stop loss.*should/,
    /weekly.*(recap|summary)/,
    /what.*(happened|learned|know about me)/,
    /plan|step by step/,
  ];

  const smartSkills = [
    'token_research', 'trending_tokens', 'defi_yields', 'whale_track',
    'weekly_recap', 'my_memory', 'portfolio_track', 'new_tokens', 'daily_recap',
  ];

  for (const pattern of smartPatterns) {
    if (pattern.test(msg)) return 'smart';
  }

  if (skillTag && smartSkills.includes(skillTag)) return 'smart';
  if (msg.length > 200) return 'smart';

  return 'fast';
}

// ============================================================
// Main chat function
// ============================================================

async function chat(messages, options = {}) {
  const complexity = options.forceModel ||
    classifyComplexity(options.userMessage || '', options.skillTag || '');

  const config = MODELS[complexity];

  console.log(`[AIRouter] ${config.provider}/${config.model} | "${(options.userMessage || '').substring(0, 60)}"`);

  try {
    if (config.provider === 'openai') {
      const client = getOpenAI();
      if (!client) throw new Error('OpenAI not configured');

      const response = await client.chat.completions.create({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: 0.7,
      });
      return {
        content: response.choices[0]?.message?.content || '',
        model: config.model,
        provider: 'openai',
        complexity,
      };
    }

    // Groq (fast)
    return await callGroq(messages, config.model, config.maxTokens, complexity);
  } catch (err) {
    console.error(`[AIRouter] ${config.provider} failed: ${err.message}`);

    // Fallback: smart → fast
    if (complexity === 'smart') {
      console.log('[AIRouter] Falling back to Groq...');
      try {
        return await callGroq(messages, MODELS.fast.model, MODELS.fast.maxTokens, 'fast (fallback)');
      } catch (fallbackErr) {
        console.error('[AIRouter] Fallback also failed:', fallbackErr.message);
        throw fallbackErr;
      }
    }

    throw err;
  }
}

async function callGroq(messages, model, maxTokens, complexity, retries = 2) {
  const models = [model, MODELS.fast.fallback];

  for (const m of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = getGroq();
        const response = await client.chat.completions.create({
          model: m,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        });
        if (m !== model) console.log(`[AIRouter] Used Groq fallback: ${m}`);
        return {
          content: response.choices[0]?.message?.content || '',
          model: m,
          provider: 'groq',
          complexity,
        };
      } catch (error) {
        const isRateLimit = error.status === 429 || error.message?.includes('rate') || error.message?.includes('429');
        const isDailyLimit = error.message?.includes('tokens per day') || error.message?.includes('TPD');

        if (isDailyLimit) {
          console.warn(`[AIRouter] Daily limit on ${m}, trying next...`);
          break;
        }
        if (isRateLimit && attempt < retries) {
          const delay = (attempt + 1) * 2000;
          console.warn(`[AIRouter] Rate limited on ${m}, retry in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (m === model) {
          console.warn(`[AIRouter] ${m} failed: ${error.message}, trying fallback...`);
          break;
        }
        throw new Error('AI service unavailable');
      }
    }
  }
  throw new Error('AI service unavailable — all models exhausted');
}

// ============================================================
// Fast-only call for memory extraction (cost saving)
// ============================================================

async function extractWithFastModel(messages) {
  const result = await callGroq(messages, MODELS.fast.model, 512, 'fast');
  return result.content;
}

module.exports = {
  chat,
  extractWithFastModel,
  classifyComplexity,
  MODELS,
};
