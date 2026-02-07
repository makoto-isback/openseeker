import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ParkMode = 'off' | 'listen' | 'active';

interface SettingsState {
  serverUrl: string;
  heartbeatEnabled: boolean;
  heartbeatIntervalMin: number; // in minutes: 15, 30, or 60
  morningBriefing: boolean;
  morningBriefingHour: number;
  nightSummary: boolean;
  nightSummaryHour: number;
  notificationsEnabled: boolean;
  lastHeartbeat: number;
  dailySpendLimit: number;
  // Agent Park
  agentName: string;
  agentId: string | null;
  parkMode: ParkMode;
  parkBudgetDaily: number;
  parkSpentToday: number;
  parkTopics: string[];
  // Domain identity
  osDomain: string | null;
  isVerified: boolean;
  domainTier: string | null;
  domainExpiresAt: string | null;
  setDomainInfo: (domain: string, tier: string, expiresAt: string) => void;
  clearDomainInfo: () => void;
  loadDomainInfo: () => Promise<void>;
  setServerUrl: (url: string) => void;
  setHeartbeatEnabled: (enabled: boolean) => void;
  setHeartbeatInterval: (minutes: number) => void;
  setMorningBriefing: (enabled: boolean) => void;
  setNightSummary: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setLastHeartbeat: (timestamp: number) => void;
  setDailySpendLimit: (limit: number) => void;
  setAgentName: (name: string) => void;
  setAgentId: (id: string | null) => void;
  setParkMode: (mode: ParkMode) => void;
  setParkBudgetDaily: (budget: number) => void;
  addParkSpend: (amount: number) => void;
  resetParkSpend: () => void;
  setParkTopics: (topics: string[]) => void;
  loadAgentName: () => Promise<void>;
}

// Update this to your Railway URL after deployment, e.g.:
// 'https://openseeker-server.up.railway.app'
// Keep http://10.0.2.2:3000 for local Android emulator development
const DEFAULT_SERVER_URL = 'http://10.0.2.2:3000';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  serverUrl: DEFAULT_SERVER_URL,
  heartbeatEnabled: true,
  heartbeatIntervalMin: 30,
  morningBriefing: true,
  morningBriefingHour: 7,
  nightSummary: true,
  nightSummaryHour: 22,
  notificationsEnabled: true,
  lastHeartbeat: 0,
  dailySpendLimit: 1.0,
  // Agent Park
  agentName: 'DegenCat',
  agentId: null,
  parkMode: 'listen',
  parkBudgetDaily: 0.05,
  parkSpentToday: 0,
  parkTopics: ['memecoins', 'defi', 'trending'],
  // Domain identity
  osDomain: null,
  isVerified: false,
  domainTier: null,
  domainExpiresAt: null,
  setDomainInfo: (domain, tier, expiresAt) => {
    set({ osDomain: domain, isVerified: true, domainTier: tier, domainExpiresAt: expiresAt });
    AsyncStorage.setItem('@openseeker/os_domain', JSON.stringify({ domain, tier, expiresAt })).catch(console.error);
  },
  clearDomainInfo: () => {
    set({ osDomain: null, isVerified: false, domainTier: null, domainExpiresAt: null });
    AsyncStorage.removeItem('@openseeker/os_domain').catch(console.error);
  },
  loadDomainInfo: async () => {
    try {
      const raw = await AsyncStorage.getItem('@openseeker/os_domain');
      if (raw) {
        const { domain, tier, expiresAt } = JSON.parse(raw);
        set({ osDomain: domain, isVerified: true, domainTier: tier, domainExpiresAt: expiresAt });
      }
    } catch {}
  },
  setServerUrl: (url) => set({ serverUrl: url }),
  setHeartbeatEnabled: (enabled) => set({ heartbeatEnabled: enabled }),
  setHeartbeatInterval: (minutes) => set({ heartbeatIntervalMin: minutes }),
  setMorningBriefing: (enabled) => set({ morningBriefing: enabled }),
  setNightSummary: (enabled) => set({ nightSummary: enabled }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setLastHeartbeat: (timestamp) => set({ lastHeartbeat: timestamp }),
  setDailySpendLimit: (limit) => set({ dailySpendLimit: limit }),
  setAgentName: (name) => {
    set({ agentName: name });
    AsyncStorage.setItem('@openseeker/agent_name', name).catch(console.error);
  },
  setAgentId: (id) => {
    set({ agentId: id });
    if (id) AsyncStorage.setItem('@openseeker/agent_id', id).catch(console.error);
  },
  setParkMode: (mode) => set({ parkMode: mode }),
  setParkBudgetDaily: (budget) => set({ parkBudgetDaily: budget }),
  addParkSpend: (amount) => {
    const current = get().parkSpentToday;
    set({ parkSpentToday: current + amount });
  },
  resetParkSpend: () => set({ parkSpentToday: 0 }),
  setParkTopics: (topics) => set({ parkTopics: topics }),
  loadAgentName: async () => {
    try {
      const name = await AsyncStorage.getItem('@openseeker/agent_name');
      if (name) set({ agentName: name });
      const id = await AsyncStorage.getItem('@openseeker/agent_id');
      if (id) set({ agentId: id });
      // Also load domain info
      const raw = await AsyncStorage.getItem('@openseeker/os_domain');
      if (raw) {
        const { domain, tier, expiresAt } = JSON.parse(raw);
        set({ osDomain: domain, isVerified: true, domainTier: tier, domainExpiresAt: expiresAt });
      }
    } catch {}
  },
}));
