import AsyncStorage from '@react-native-async-storage/async-storage';
import { addXP } from './gamification';

const DCA_KEY = '@openseeker/automations';

export interface DCAConfig {
  id: string;
  fromToken: string;
  toToken: string;
  amount: number;
  intervalHours: number;
  nextExecution: number;
  totalExecuted: number;
  active: boolean;
  createdAt: number;
}

export async function getDCAConfigs(): Promise<DCAConfig[]> {
  const value = await AsyncStorage.getItem(DCA_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function saveConfigs(configs: DCAConfig[]): Promise<void> {
  await AsyncStorage.setItem(DCA_KEY, JSON.stringify(configs));
}

export async function addDCAConfig(
  fromToken: string,
  toToken: string,
  amount: number,
  intervalHours: number,
): Promise<DCAConfig> {
  const configs = await getDCAConfigs();
  const config: DCAConfig = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    fromToken: fromToken.toUpperCase(),
    toToken: toToken.toUpperCase(),
    amount,
    intervalHours,
    nextExecution: Date.now() + intervalHours * 60 * 60 * 1000,
    totalExecuted: 0,
    active: true,
    createdAt: Date.now(),
  };
  configs.push(config);
  await saveConfigs(configs);
  addXP(5).catch(console.error);
  return config;
}

export async function removeDCAConfig(id: string): Promise<void> {
  const configs = await getDCAConfigs();
  const filtered = configs.filter((c) => c.id !== id);
  await saveConfigs(filtered);
}

export async function toggleDCA(id: string): Promise<void> {
  const configs = await getDCAConfigs();
  const config = configs.find((c) => c.id === id);
  if (config) {
    config.active = !config.active;
    if (config.active) {
      config.nextExecution = Date.now() + config.intervalHours * 60 * 60 * 1000;
    }
    await saveConfigs(configs);
  }
}

export async function checkDCAExecutions(): Promise<DCAConfig[]> {
  const configs = await getDCAConfigs();
  const now = Date.now();
  return configs.filter((c) => c.active && c.nextExecution <= now);
}

export async function markDCAExecuted(id: string): Promise<void> {
  const configs = await getDCAConfigs();
  const config = configs.find((c) => c.id === id);
  if (config) {
    config.totalExecuted += 1;
    config.nextExecution = Date.now() + config.intervalHours * 60 * 60 * 1000;
    await saveConfigs(configs);
  }
}
