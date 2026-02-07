import AsyncStorage from '@react-native-async-storage/async-storage';

const ACHIEVEMENTS_KEY = '@openseeker/achievements';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  progress: number;
  unlocked: boolean;
  unlockedAt?: number;
}

const ACHIEVEMENT_DEFS: Omit<Achievement, 'progress' | 'unlocked' | 'unlockedAt'>[] = [
  { id: 'first_blood', title: 'First Blood', description: 'Complete your first trade', emoji: '[x]', target: 1 },
  { id: 'green_day', title: 'Green Day', description: 'All positions in profit', emoji: '[+]', target: 1 },
  { id: 'diamond_hands', title: 'Diamond Hands', description: 'Hold a position for 30 days', emoji: '<>', target: 1 },
  { id: 'whale_spotter', title: 'Whale Spotter', description: 'Check whale activity 10 times', emoji: '[~]', target: 10 },
  { id: 'data_nerd', title: 'Data Nerd', description: 'Check portfolio 50 times', emoji: '[#]', target: 50 },
  { id: 'night_owl', title: 'Night Owl', description: 'Trade after midnight', emoji: '[z]', target: 1 },
  { id: 'early_bird', title: 'Early Bird', description: 'Trade before 7am', emoji: '[>]', target: 1 },
  { id: 'social_butterfly', title: 'Social Butterfly', description: 'Post 10 times in Agent Park', emoji: '[@]', target: 10 },
  { id: 'penny_pincher', title: 'Penny Pincher', description: 'Spend less than $0.10 in a day', emoji: '[.]', target: 1 },
  { id: 'big_spender', title: 'Big Spender', description: 'Spend over $1.00 in a day', emoji: '[$]', target: 1 },
];

async function loadAchievements(): Promise<Achievement[]> {
  const val = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
  if (!val) {
    return ACHIEVEMENT_DEFS.map((d) => ({ ...d, progress: 0, unlocked: false }));
  }
  try {
    const saved: Achievement[] = JSON.parse(val);
    // Merge with defs in case new achievements were added
    return ACHIEVEMENT_DEFS.map((def) => {
      const existing = saved.find((s) => s.id === def.id);
      return existing || { ...def, progress: 0, unlocked: false };
    });
  } catch {
    return ACHIEVEMENT_DEFS.map((d) => ({ ...d, progress: 0, unlocked: false }));
  }
}

async function saveAchievements(achievements: Achievement[]): Promise<void> {
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
}

export async function getAchievements(): Promise<Achievement[]> {
  return loadAchievements();
}

export async function checkAchievement(id: string): Promise<boolean> {
  const achievements = await loadAchievements();
  const achievement = achievements.find((a) => a.id === id);
  return achievement?.unlocked || false;
}

export async function incrementProgress(id: string): Promise<{ unlocked: boolean; achievement?: Achievement }> {
  const achievements = await loadAchievements();
  const achievement = achievements.find((a) => a.id === id);

  if (!achievement || achievement.unlocked) {
    return { unlocked: false };
  }

  achievement.progress = Math.min(achievement.progress + 1, achievement.target);

  if (achievement.progress >= achievement.target) {
    achievement.unlocked = true;
    achievement.unlockedAt = Date.now();
    await saveAchievements(achievements);
    return { unlocked: true, achievement };
  }

  await saveAchievements(achievements);
  return { unlocked: false };
}
