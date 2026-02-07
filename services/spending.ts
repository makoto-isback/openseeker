import AsyncStorage from '@react-native-async-storage/async-storage';

const SPENDING_KEY = '@openseeker/spending';

export interface SpendRecord {
  timestamp: number;
  endpoint: string;
  amount: number;
}

async function getRecords(): Promise<SpendRecord[]> {
  const value = await AsyncStorage.getItem(SPENDING_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function saveRecords(records: SpendRecord[]): Promise<void> {
  await AsyncStorage.setItem(SPENDING_KEY, JSON.stringify(records));
}

export async function recordSpend(endpoint: string, amount: number): Promise<void> {
  const records = await getRecords();
  records.push({ timestamp: Date.now(), endpoint, amount });
  await saveRecords(records);
}

export async function getTodaySpend(): Promise<number> {
  const records = await getRecords();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayStart = startOfDay.getTime();

  return records
    .filter((r) => r.timestamp >= todayStart)
    .reduce((sum, r) => sum + r.amount, 0);
}

export async function getMonthSpend(): Promise<number> {
  const records = await getRecords();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  return records
    .filter((r) => r.timestamp >= startOfMonth)
    .reduce((sum, r) => sum + r.amount, 0);
}

export async function checkDailyLimit(limit: number): Promise<{ exceeded: boolean; current: number }> {
  const current = await getTodaySpend();
  return { exceeded: current >= limit, current };
}

export async function clearSpendHistory(): Promise<void> {
  await AsyncStorage.removeItem(SPENDING_KEY);
}
