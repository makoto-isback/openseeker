import { create } from 'zustand';
import * as memory from '../services/memory';

interface MemoryState {
  soul: string;
  userMemory: string;
  daily: string;
  wallet: string;
  isLoaded: boolean;
  loadAll: () => Promise<void>;
  updateSoul: (content: string) => Promise<void>;
  updateMemory: (content: string) => Promise<void>;
  appendDaily: (entry: string) => Promise<void>;
  updateWallet: (content: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  soul: '',
  userMemory: '',
  daily: '',
  wallet: '',
  isLoaded: false,

  loadAll: async () => {
    await memory.initializeMemory();
    const [soul, userMemory, daily, wallet] = await Promise.all([
      memory.readSoul(),
      memory.readMemory(),
      memory.readDaily(),
      memory.readWallet(),
    ]);
    set({ soul, userMemory, daily, wallet, isLoaded: true });
  },

  updateSoul: async (content: string) => {
    await memory.updateSoul(content);
    set({ soul: content });
  },

  updateMemory: async (content: string) => {
    await memory.updateMemory(content);
    set({ userMemory: content });
  },

  appendDaily: async (entry: string) => {
    await memory.appendDaily(entry);
    const daily = await memory.readDaily();
    set({ daily });
  },

  updateWallet: async (content: string) => {
    await memory.updateWallet(content);
    set({ wallet: content });
  },
}));
