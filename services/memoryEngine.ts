import * as memory from './memory';
import { incrementMessageCount, getMessageCount as getPersistentMessageCount } from './memory';

const COMPRESSION_THRESHOLD = 20;

// Known token symbols for detection
const TOKEN_SYMBOLS = [
  'SOL', 'BTC', 'ETH', 'WIF', 'BONK', 'JUP', 'RNDR', 'HNT',
  'PYTH', 'RAY', 'ORCA', 'MSOL', 'JITO', 'USDC', 'USDT',
];

const TRADE_KEYWORDS = ['bought', 'sold', 'swap', 'swapped', 'trade', 'traded', 'buy', 'sell', 'aped', 'longed', 'shorted'];
const PREFERENCE_KEYWORDS = ['like', 'love', 'hate', 'prefer', 'favorite', 'favourite', 'bullish on', 'bearish on'];

// Patterns that indicate user is sharing personal info
const PERSONAL_INFO_PATTERNS = [
  /my name is (\w+)/i,
  /i(?:'m| am) (\w+)/i,
  /call me (\w+)/i,
  /i live in (.+?)(?:\.|,|$)/i,
  /i(?:'m| am) from (.+?)(?:\.|,|$)/i,
  /i work (?:at|as|in) (.+?)(?:\.|,|$)/i,
  /my (?:wallet|address) is (.+?)(?:\.|,|$)/i,
  /i(?:'ve| have) been (?:trading|investing) (?:for )?(.+?)(?:\.|,|$)/i,
  /my strategy is (.+?)(?:\.|,|$)/i,
  /i usually (.+?)(?:\.|,|$)/i,
  /i always (.+?)(?:\.|,|$)/i,
  /i never (.+?)(?:\.|,|$)/i,
  /my goal is (.+?)(?:\.|,|$)/i,
  /i want to (.+?)(?:\.|,|$)/i,
];

/**
 * Process an AI response — update daily log, extract facts, maybe compress context.
 */
export async function processResponse(userMessage: string, aiResponse: string): Promise<void> {
  console.log('[MEMORY_ENGINE] Processing response...');
  console.log('[MEMORY_ENGINE] User message:', userMessage.slice(0, 100));

  // 1. Append to daily log
  const userSummary = truncate(userMessage, 80);
  const aiSummary = truncate(aiResponse, 80);
  await memory.appendDaily(`User: ${userSummary} → Agent: ${aiSummary}`);
  console.log('[MEMORY_ENGINE] Daily log updated');

  // 2. Extract facts
  console.log('[MEMORY_ENGINE] Extracting facts...');
  await extractFacts(userMessage, aiResponse);

  // 3. Check if we should compress context (using persistent count)
  const currentCount = await incrementMessageCount();
  console.log(`[MEMORY_ENGINE] Persistent message count: ${currentCount}/${COMPRESSION_THRESHOLD}`);
  if (currentCount >= COMPRESSION_THRESHOLD) {
    console.log('[MEMORY_ENGINE] Threshold reached, compressing context...');
    await compressContext();
    await memory.setMessageCount(0);
    console.log('[MEMORY_ENGINE] Context compressed, message count reset');
  }

  console.log('[MEMORY_ENGINE] Processing complete');
}

/**
 * Compress the last batch of conversation into a context summary.
 */
async function compressContext(): Promise<void> {
  const messages = await memory.readMessages();
  const recent = messages.slice(-COMPRESSION_THRESHOLD);

  if (recent.length === 0) return;

  // Simple template-based summarization (will be AI-powered later)
  const topics = new Set<string>();
  for (const msg of recent) {
    const upper = msg.content.toUpperCase();
    for (const token of TOKEN_SYMBOLS) {
      if (upper.includes(token)) topics.add(token);
    }
  }

  const topicStr = topics.size > 0 ? `Tokens discussed: ${[...topics].join(', ')}. ` : '';
  const timestamp = new Date().toISOString().slice(0, 16);
  const summary = `[${timestamp}] ${recent.length} messages exchanged. ${topicStr}`;

  const existing = await memory.getContext();
  await memory.compressContext(existing + summary + '\n');
}

/**
 * Extract facts from a message exchange and update memory/wallet.
 */
async function extractFacts(userMessage: string, aiResponse: string): Promise<void> {
  const combined = `${userMessage} ${aiResponse}`.toLowerCase();
  const updates: string[] = [];
  const timestamp = new Date().toISOString().slice(0, 10);

  // 1. Extract personal information from user message
  for (const pattern of PERSONAL_INFO_PATTERNS) {
    const match = userMessage.match(pattern);
    if (match) {
      const fact = `[${timestamp}] User info: "${userMessage.slice(0, 150)}"`;
      updates.push(fact);
      console.log('[MEMORY_ENGINE] Found personal info:', match[0]);
      break; // Only capture one personal info per message
    }
  }

  // 2. Check for trade-related facts
  const hasTrade = TRADE_KEYWORDS.some((kw) => combined.includes(kw));
  if (hasTrade) {
    const mentionedTokens = findTokens(combined);
    if (mentionedTokens.length > 0) {
      updates.push(`[${timestamp}] Trade mention: "${truncate(userMessage, 100)}" (tokens: ${mentionedTokens.join(', ')})`);
      console.log('[MEMORY_ENGINE] Found trade mention:', mentionedTokens);

      // Append to wallet notes
      const wallet = await memory.readWallet();
      const walletEntry = `\n- [${timestamp}] ${truncate(userMessage, 80)}`;
      if (!wallet.includes('## Trade Notes')) {
        await memory.updateWallet(wallet + '\n## Trade Notes' + walletEntry);
      } else {
        await memory.updateWallet(wallet + walletEntry);
      }
    }
  }

  // 3. Check for preference-related facts
  const hasPref = PREFERENCE_KEYWORDS.some((kw) => combined.includes(kw));
  if (hasPref) {
    const mentionedTokens = findTokens(combined);
    // Save the actual preference statement, not just token list
    const prefFact = `[${timestamp}] Preference: "${truncate(userMessage, 120)}"`;
    updates.push(prefFact);
    console.log('[MEMORY_ENGINE] Found preference:', userMessage.slice(0, 50));
  }

  // 4. Log any token mentions for tracking
  const mentionedTokens = findTokens(userMessage.toLowerCase());
  if (mentionedTokens.length > 0 && !hasTrade && !hasPref) {
    updates.push(`[${timestamp}] Tokens discussed: ${mentionedTokens.join(', ')}`);
  }

  // 5. Write all collected facts to memory
  if (updates.length > 0) {
    console.log('[MEMORY_ENGINE] Updating MEMORY.md with:', updates);
    const currentMemory = await memory.readMemory();
    const newFacts = updates.join('\n');
    await memory.updateMemory(currentMemory + '\n' + newFacts);
    console.log('[MEMORY_ENGINE] Write complete');
  } else {
    console.log('[MEMORY_ENGINE] No facts to extract from this message');
  }
}

function findTokens(text: string): string[] {
  const upper = text.toUpperCase();
  return TOKEN_SYMBOLS.filter((token) => {
    // Match whole word to avoid false positives
    const regex = new RegExp(`\\b${token}\\b`);
    return regex.test(upper);
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export async function getMessageCount(): Promise<number> {
  return await getPersistentMessageCount();
}

export async function resetMessageCount(): Promise<void> {
  await memory.setMessageCount(0);
  console.log('[MEMORY_ENGINE] Message count reset to 0');
}
