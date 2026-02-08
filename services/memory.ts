import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_MEMORY } from '../constants/defaults';

// AsyncStorage key constants
const KEYS = {
  MEMORY: '@openseeker/memory',
  DAILY: '@openseeker/daily',
  CONTEXT: '@openseeker/context',
  MESSAGES: '@openseeker/messages',
  MESSAGE_COUNT: '@openseeker/message_count',
  LAST_DAILY_DATE: '@openseeker/last_daily_date',
} as const;

// --- MEMORY ---

export async function readMemory(): Promise<string> {
  try {
    const value = await AsyncStorage.getItem(KEYS.MEMORY);
    return value ?? DEFAULT_MEMORY;
  } catch (error) {
    console.error('[MEMORY] Failed to read MEMORY:', error);
    return DEFAULT_MEMORY;
  }
}

export async function updateMemory(content: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.MEMORY, content);
    console.log('[MEMORY] MEMORY.md updated successfully, length:', content.length);
  } catch (error) {
    console.error('[MEMORY] Failed to update MEMORY:', error);
    throw error;
  }
}

// --- DAILY ---

export async function readDaily(): Promise<string> {
  try {
    // Check if we need to reset for a new day
    await checkDailyReset();
    const value = await AsyncStorage.getItem(KEYS.DAILY);
    return value ?? '';
  } catch (error) {
    console.error('[MEMORY] Failed to read DAILY:', error);
    return '';
  }
}

async function checkDailyReset(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lastDate = await AsyncStorage.getItem(KEYS.LAST_DAILY_DATE);

    if (lastDate !== today) {
      // New day - archive old daily and start fresh
      const oldDaily = await AsyncStorage.getItem(KEYS.DAILY);
      if (oldDaily && oldDaily.length > 0) {
        console.log(`[DAILY] New day detected. Archiving ${oldDaily.length} chars from ${lastDate}`);
        // Could archive to CONTEXT.md here if desired
      }
      await AsyncStorage.setItem(KEYS.DAILY, `# Daily Log - ${today}\n`);
      await AsyncStorage.setItem(KEYS.LAST_DAILY_DATE, today);
      console.log(`[DAILY] Reset for new day: ${today}`);
    }
  } catch (error) {
    console.error('[DAILY] Reset check failed:', error);
  }
}

export async function appendDaily(entry: string): Promise<void> {
  try {
    await checkDailyReset();
    const existing = await AsyncStorage.getItem(KEYS.DAILY) || '';
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const newEntry = `[${timestamp}] ${entry}\n`;
    await AsyncStorage.setItem(KEYS.DAILY, existing + newEntry);
    console.log(`[DAILY] Appending: "${entry.slice(0, 50)}..."`);
  } catch (error) {
    console.error('[MEMORY] Failed to append DAILY:', error);
    throw error;
  }
}

// --- CONTEXT ---

export async function getContext(): Promise<string> {
  try {
    const value = await AsyncStorage.getItem(KEYS.CONTEXT);
    return value ?? '';
  } catch (error) {
    console.error('[MEMORY] Failed to read CONTEXT:', error);
    return '';
  }
}

export async function compressContext(summary: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.CONTEXT, summary);
    console.log('[CONTEXT] Summary saved, length:', summary.length);
  } catch (error) {
    console.error('[MEMORY] Failed to compress CONTEXT:', error);
    throw error;
  }
}

// --- MESSAGE COUNT (persistent) ---

export async function getMessageCount(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(KEYS.MESSAGE_COUNT);
    const count = value ? parseInt(value, 10) : 0;
    return isNaN(count) ? 0 : count;
  } catch (error) {
    console.error('[MEMORY] Failed to read message count:', error);
    return 0;
  }
}

export async function setMessageCount(count: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.MESSAGE_COUNT, count.toString());
  } catch (error) {
    console.error('[MEMORY] Failed to set message count:', error);
  }
}

export async function incrementMessageCount(): Promise<number> {
  const current = await getMessageCount();
  const newCount = current + 1;
  await setMessageCount(newCount);
  console.log(`[CONTEXT] Message count: ${newCount}/20`);
  return newCount;
}

// --- RAW DEBUG ACCESS ---

export async function getRawMemoryDebug(): Promise<{
  memory: string;
  daily: string;
  context: string;
  messageCount: number;
  lastDailyDate: string;
}> {
  try {
    const [memory, daily, context, messageCount, lastDailyDate] = await Promise.all([
      AsyncStorage.getItem(KEYS.MEMORY),
      AsyncStorage.getItem(KEYS.DAILY),
      AsyncStorage.getItem(KEYS.CONTEXT),
      AsyncStorage.getItem(KEYS.MESSAGE_COUNT),
      AsyncStorage.getItem(KEYS.LAST_DAILY_DATE),
    ]);
    return {
      memory: memory ?? '(not set)',
      daily: daily ?? '(not set)',
      context: context ?? '(not set)',
      messageCount: messageCount ? parseInt(messageCount, 10) : 0,
      lastDailyDate: lastDailyDate ?? '(not set)',
    };
  } catch (error) {
    console.error('[MEMORY] Failed to get raw debug:', error);
    return {
      memory: '(error)',
      daily: '(error)',
      context: '(error)',
      messageCount: 0,
      lastDailyDate: '(error)',
    };
  }
}

// --- TEST MEMORY FUNCTION ---

export async function testMemorySystems(): Promise<{
  success: boolean;
  results: {
    daily: boolean;
    memory: boolean;
    context: boolean;
    messageCount: boolean;
  };
  errors: string[];
}> {
  const errors: string[] = [];
  const results = {
    daily: false,
    memory: false,
    context: false,
    messageCount: false,
  };

  // Test DAILY.md
  try {
    const before = await readDaily();
    await appendDaily('[TEST] Memory test entry');
    const after = await readDaily();
    results.daily = after.length > before.length;
    if (!results.daily) errors.push('DAILY: Append did not increase length');
  } catch (e: any) {
    errors.push(`DAILY: ${e.message}`);
  }

  // Test MEMORY.md
  try {
    const before = await readMemory();
    const testFact = `\n[TEST] Test fact at ${Date.now()}`;
    await updateMemory(before + testFact);
    const after = await readMemory();
    results.memory = after.includes('[TEST] Test fact');
    if (!results.memory) errors.push('MEMORY: Update not persisted');
  } catch (e: any) {
    errors.push(`MEMORY: ${e.message}`);
  }

  // Test CONTEXT.md
  try {
    const testSummary = `[TEST] Context compression test at ${Date.now()}\n`;
    const before = await getContext();
    await compressContext(before + testSummary);
    const after = await getContext();
    results.context = after.includes('[TEST] Context compression');
    if (!results.context) errors.push('CONTEXT: Compression not persisted');
  } catch (e: any) {
    errors.push(`CONTEXT: ${e.message}`);
  }

  // Test message count
  try {
    const before = await getMessageCount();
    await incrementMessageCount();
    const after = await getMessageCount();
    results.messageCount = after === before + 1;
    if (!results.messageCount) errors.push('MESSAGE_COUNT: Increment failed');
    // Reset to before
    await setMessageCount(before);
  } catch (e: any) {
    errors.push(`MESSAGE_COUNT: ${e.message}`);
  }

  const success = Object.values(results).every(Boolean);
  return { success, results, errors };
}

// --- MESSAGES ---

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  skillResults?: Array<{
    skill: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  x402?: {
    paid: boolean;
    free: boolean;
    freeRemaining?: number;
    amount?: string;
  };
  isNew?: boolean; // true for messages just created in this session (animate)
}

export async function readMessages(): Promise<Message[]> {
  try {
    const value = await AsyncStorage.getItem(KEYS.MESSAGES);
    if (!value) return [];
    return JSON.parse(value);
  } catch (error) {
    console.error('[MEMORY] Failed to read MESSAGES:', error);
    return [];
  }
}

export async function saveMessages(messages: Message[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
  } catch (error) {
    console.error('[MEMORY] Failed to save MESSAGES:', error);
    throw error;
  }
}

// --- INITIALIZATION ---

export async function initializeMemory(): Promise<void> {
  try {
    const memory = await AsyncStorage.getItem(KEYS.MEMORY);
    if (memory === null) {
      await AsyncStorage.setItem(KEYS.MEMORY, DEFAULT_MEMORY);
      console.log('[MEMORY] Initialized MEMORY.md with defaults');
    }

    // Initialize daily date tracking
    const lastDate = await AsyncStorage.getItem(KEYS.LAST_DAILY_DATE);
    if (lastDate === null) {
      const today = new Date().toISOString().slice(0, 10);
      await AsyncStorage.setItem(KEYS.LAST_DAILY_DATE, today);
      await AsyncStorage.setItem(KEYS.DAILY, `# Daily Log - ${today}\n`);
    }

    console.log('[MEMORY] Memory system initialized');
  } catch (error) {
    console.error('[MEMORY] Failed to initialize:', error);
  }
}
