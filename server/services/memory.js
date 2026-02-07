/**
 * Server-side persistent memory service.
 * Uses SQLite for storage — same DB as credit system.
 * Provides agent memory (facts about user) and daily logging.
 */
const {
  getMemories,
  saveMemory,
  deleteMemory,
  deleteMemoryByContent,
  getMemoryCount,
  getDailyLog,
  getRecentDailyLogs,
  appendDailyEvent,
  getDailySummaries,
  getOrCreateUser,
} = require('../db');
const { extractWithFastModel } = require('./aiRouter');

// Memory categories
const CATEGORIES = [
  'preference',    // User preferences (risk tolerance, favorite tokens, etc.)
  'portfolio',     // Portfolio-related facts
  'trading',       // Trading patterns and history
  'personal',      // Personal info (name, timezone, etc.)
  'strategy',      // Investment strategies
  'general',       // Anything else
];

const MAX_MEMORIES_PER_WALLET = 100;

/**
 * Get all memories for a wallet, optionally filtered by category.
 */
function getAgentMemory(walletAddress, category = null) {
  return getMemories(walletAddress, category);
}

/**
 * Save a single memory fact.
 */
function saveMemoryFact(walletAddress, content, category = 'general', source = 'chat', confidence = 0.8) {
  // Check memory limit
  const count = getMemoryCount(walletAddress);
  if (count >= MAX_MEMORIES_PER_WALLET) {
    // Don't save if at limit — oldest memories stay, new ones get dropped
    // In production, could implement LRU or importance-based eviction
    return { success: false, error: 'Memory limit reached' };
  }

  return saveMemory(walletAddress, content, category, source, confidence);
}

/**
 * Save multiple memory facts at once.
 */
function saveMemories(walletAddress, memories) {
  const results = [];
  for (const mem of memories) {
    const result = saveMemoryFact(
      walletAddress,
      mem.content,
      mem.category || 'general',
      mem.source || 'chat',
      mem.confidence || 0.8,
    );
    results.push(result);
  }
  return results;
}

/**
 * Remove a specific memory by ID.
 */
function forgetMemory(walletAddress, memoryId) {
  return deleteMemory(walletAddress, memoryId);
}

/**
 * Remove memories matching a search term.
 */
function forgetMemoryByContent(walletAddress, searchTerm) {
  return deleteMemoryByContent(walletAddress, searchTerm);
}

/**
 * Extract memories from a chat exchange using AI.
 * Called async after each chat response.
 */
async function extractMemoriesFromChat(walletAddress, userMessage, aiResponse) {
  try {
    const extractPrompt = [
      {
        role: 'system',
        content: `You are a memory extraction system. Given a user message and AI response, extract any facts worth remembering about the user.

Categories: preference, portfolio, trading, personal, strategy, general

Return JSON array of memories. Each memory is: {"content": "fact", "category": "category", "confidence": 0.0-1.0}

Rules:
- Only extract CONCRETE facts (not vague statements)
- Don't extract greetings, questions, or temporary states
- Prefer short, specific facts (under 50 words each)
- confidence: 1.0 for explicit statements, 0.6-0.8 for inferred
- Return [] if nothing worth remembering
- Maximum 3 memories per exchange

Examples of good memories:
- {"content": "User holds 10 SOL", "category": "portfolio", "confidence": 1.0}
- {"content": "User prefers high-risk memecoins", "category": "preference", "confidence": 0.8}
- {"content": "User's timezone is PST", "category": "personal", "confidence": 0.9}
- {"content": "User uses DCA strategy for SOL accumulation", "category": "strategy", "confidence": 0.8}

Examples of things NOT to extract:
- "User said gm" (too trivial)
- "User asked about SOL price" (temporary question, not a fact)
- "AI told user about WIF" (about AI, not user)`,
      },
      {
        role: 'user',
        content: `User message: "${userMessage}"\n\nAI response: "${aiResponse.slice(0, 500)}"\n\nExtract memories (JSON array only, no markdown):`,
      },
    ];

    const result = await extractWithFastModel(extractPrompt);

    // Parse JSON from response
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const memories = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(memories)) return [];

    // Save each valid memory
    const saved = [];
    for (const mem of memories.slice(0, 3)) {
      if (mem.content && typeof mem.content === 'string' && mem.content.length > 5) {
        const category = CATEGORIES.includes(mem.category) ? mem.category : 'general';
        const confidence = typeof mem.confidence === 'number' ? Math.min(1, Math.max(0, mem.confidence)) : 0.8;
        const result = saveMemoryFact(walletAddress, mem.content, category, 'chat_extraction', confidence);
        if (result.success) {
          saved.push(mem);
        }
      }
    }

    if (saved.length > 0) {
      console.log(`[Memory] Extracted ${saved.length} memories for ${walletAddress.slice(0, 8)}...`);
    }
    return saved;
  } catch (err) {
    console.error('[Memory] extractMemoriesFromChat error:', err.message);
    return [];
  }
}

/**
 * Extract memory from a trade event.
 */
function extractMemoryFromTrade(walletAddress, tradeData) {
  const { fromSymbol, toSymbol, fromAmount, toAmount } = tradeData;
  const content = `Swapped ${fromAmount} ${fromSymbol} for ${toAmount} ${toSymbol}`;
  saveMemoryFact(walletAddress, content, 'trading', 'trade', 1.0);
  appendDailyEvent(walletAddress, 'trade', content, tradeData);
}

/**
 * Log a daily event.
 */
function logDailyEvent(walletAddress, eventType, content, metadata = null) {
  return appendDailyEvent(walletAddress, eventType, content, metadata);
}

/**
 * Get today's daily log for a wallet.
 */
function getTodayLog(walletAddress) {
  const today = new Date().toISOString().split('T')[0];
  return getDailyLog(walletAddress, today);
}

/**
 * Get recent daily logs.
 */
function getRecentLogs(walletAddress, limit = 50) {
  return getRecentDailyLogs(walletAddress, limit);
}

/**
 * Generate a daily summary using AI.
 */
async function generateDailySummary(walletAddress) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const events = getDailyLog(walletAddress, today);

    if (events.length === 0) {
      return { summary: 'No activity today.', events_count: 0 };
    }

    const eventText = events.map((e) => `[${e.event_type}] ${e.content}`).join('\n');

    const summaryPrompt = [
      {
        role: 'system',
        content: 'Summarize this agent\'s daily activity in 2-3 sentences. Be concise and focus on key actions and outcomes.',
      },
      {
        role: 'user',
        content: `Daily events:\n${eventText}\n\nSummarize:`,
      },
    ];

    const summary = await extractWithFastModel(summaryPrompt);
    return { summary, events_count: events.length, date: today };
  } catch (err) {
    console.error('[Memory] generateDailySummary error:', err.message);
    return { summary: 'Could not generate summary.', events_count: 0 };
  }
}

/**
 * Generate a weekly recap.
 */
async function generateWeeklyRecap(walletAddress) {
  try {
    const summaries = getDailySummaries(walletAddress, 7);
    const memories = getMemories(walletAddress, null);

    if (summaries.length === 0 && memories.length === 0) {
      return { recap: 'No activity this week.', days: 0 };
    }

    const daysText = summaries
      .map((d) => `${d.date}: ${d.events} (${d.event_count} events)`)
      .join('\n');

    const memText = memories
      .slice(0, 20)
      .map((m) => `[${m.category}] ${m.content}`)
      .join('\n');

    const recapPrompt = [
      {
        role: 'system',
        content: 'Generate a weekly recap for this crypto agent. Include key trades, portfolio changes, new learnings, and patterns noticed. Be concise (under 200 words). Use a fun, crypto-native tone.',
      },
      {
        role: 'user',
        content: `Weekly activity:\n${daysText || '(no daily logs)'}\n\nKnown facts about user:\n${memText || '(no memories yet)'}\n\nGenerate weekly recap:`,
      },
    ];

    const recap = await extractWithFastModel(recapPrompt);
    return { recap, days: summaries.length, total_events: summaries.reduce((sum, d) => sum + d.event_count, 0) };
  } catch (err) {
    console.error('[Memory] generateWeeklyRecap error:', err.message);
    return { recap: 'Could not generate weekly recap.', days: 0 };
  }
}

/**
 * Format memories for inclusion in AI system prompt.
 * Returns a formatted string of relevant memories.
 */
function formatMemoryForPrompt(walletAddress) {
  const memories = getMemories(walletAddress, null);
  if (memories.length === 0) return '';

  // Group by category
  const grouped = {};
  for (const mem of memories) {
    if (!grouped[mem.category]) grouped[mem.category] = [];
    grouped[mem.category].push(mem);
  }

  const sections = [];
  for (const [category, mems] of Object.entries(grouped)) {
    const items = mems.map((m) => `- ${m.content}`).join('\n');
    sections.push(`[${category.toUpperCase()}]\n${items}`);
  }

  return sections.join('\n\n');
}

/**
 * Get free message credits for a wallet.
 * New wallets get 100 free messages.
 */
function getCreditsInfo(walletAddress) {
  const user = getOrCreateUser(walletAddress);
  return {
    balance: user.balance_usdc,
    total_deposited: user.total_deposited,
    total_spent: user.total_spent,
  };
}

module.exports = {
  getAgentMemory,
  saveMemoryFact,
  saveMemories,
  forgetMemory,
  forgetMemoryByContent,
  extractMemoriesFromChat,
  extractMemoryFromTrade,
  logDailyEvent,
  getTodayLog,
  getRecentLogs,
  generateDailySummary,
  generateWeeklyRecap,
  formatMemoryForPrompt,
  getCreditsInfo,
  getMemoryCount,
  CATEGORIES,
  MAX_MEMORIES_PER_WALLET,
};
