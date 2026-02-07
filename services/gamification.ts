import AsyncStorage from '@react-native-async-storage/async-storage';

const XP_KEY = '@openseeker/xp';
const LEVEL_KEY = '@openseeker/level';

interface LevelDef {
  level: number;
  title: string;
  emoji: string;
  threshold: number;
}

const LEVELS: LevelDef[] = [
  { level: 1, title: 'Newborn', emoji: '[.]', threshold: 0 },
  { level: 2, title: 'Curious', emoji: '[?]', threshold: 100 },
  { level: 3, title: 'Learning', emoji: '[=]', threshold: 300 },
  { level: 4, title: 'Trader', emoji: '[$]', threshold: 600 },
  { level: 5, title: 'Skilled', emoji: '[+]', threshold: 1000 },
  { level: 6, title: 'Expert', emoji: '[#]', threshold: 1500 },
  { level: 7, title: 'Master', emoji: '[*]', threshold: 2100 },
  { level: 8, title: 'Legend', emoji: '[@]', threshold: 2800 },
  { level: 9, title: 'Mythic', emoji: '[~]', threshold: 3600 },
  { level: 10, title: 'Transcendent', emoji: '{!}', threshold: 5000 },
];

export async function getXP(): Promise<number> {
  const val = await AsyncStorage.getItem(XP_KEY);
  return val ? parseInt(val, 10) : 0;
}

export async function getLevel(): Promise<number> {
  const val = await AsyncStorage.getItem(LEVEL_KEY);
  return val ? parseInt(val, 10) : 1;
}

function calculateLevel(xp: number): number {
  let level = 1;
  for (const def of LEVELS) {
    if (xp >= def.threshold) {
      level = def.level;
    }
  }
  return level;
}

export async function addXP(amount: number): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
  const currentXP = await getXP();
  const currentLevel = await getLevel();
  const newXP = currentXP + amount;
  const newLevel = calculateLevel(newXP);
  const leveledUp = newLevel > currentLevel;

  await AsyncStorage.setItem(XP_KEY, newXP.toString());
  await AsyncStorage.setItem(LEVEL_KEY, newLevel.toString());

  return { newXP, newLevel, leveledUp };
}

export function getLevelInfo(level: number): {
  title: string;
  emoji: string;
  nextThreshold: number;
  currentThreshold: number;
  progress: number;
} {
  const current = LEVELS.find((l) => l.level === level) || LEVELS[0];
  const next = LEVELS.find((l) => l.level === level + 1);

  const nextThreshold = next ? next.threshold : current.threshold;
  const currentThreshold = current.threshold;

  return {
    title: current.title,
    emoji: current.emoji,
    nextThreshold,
    currentThreshold,
    progress: next
      ? 0 // will be calculated with actual XP
      : 1, // max level
  };
}

export function getXPProgress(xp: number, level: number): number {
  const current = LEVELS.find((l) => l.level === level) || LEVELS[0];
  const next = LEVELS.find((l) => l.level === level + 1);
  if (!next) return 1;
  const range = next.threshold - current.threshold;
  if (range <= 0) return 1;
  return (xp - current.threshold) / range;
}
