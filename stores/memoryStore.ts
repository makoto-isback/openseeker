import { create } from 'zustand';
import * as memory from '../services/memory';

interface MemoryState {
  userMemory: string;
  daily: string;
  isLoaded: boolean;
  loadAll: () => Promise<void>;
  updateMemory: (content: string) => Promise<void>;
  appendDaily: (entry: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  userMemory: '',
  daily: '',
  isLoaded: false,

  loadAll: async () => {
    await memory.initializeMemory();
    const [userMemory, daily] = await Promise.all([
      memory.readMemory(),
      memory.readDaily(),
    ]);
    set({ userMemory, daily, isLoaded: true });
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
}));
