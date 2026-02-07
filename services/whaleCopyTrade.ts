/**
 * Whale Copy Trade Service — Track whale wallets and monitor activity
 *
 * Client-side service for:
 * - Managing watched whale wallets (AsyncStorage)
 * - Fetching whale activity from server
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCHED_WALLETS_KEY = '@openseeker/watched_wallets';

export interface WatchedWallet {
  address: string;
  label: string;
  addedAt: number;
}

/**
 * Get all watched whale wallets.
 */
export async function getWatchedWallets(): Promise<WatchedWallet[]> {
  const value = await AsyncStorage.getItem(WATCHED_WALLETS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

/**
 * Add a wallet to the watch list.
 */
export async function addWatchedWallet(address: string, label?: string): Promise<WatchedWallet> {
  const wallets = await getWatchedWallets();

  // Don't add duplicates
  const existing = wallets.find(w => w.address === address);
  if (existing) return existing;

  const wallet: WatchedWallet = {
    address,
    label: label || `Whale ${address.slice(0, 6)}`,
    addedAt: Date.now(),
  };

  wallets.push(wallet);
  await AsyncStorage.setItem(WATCHED_WALLETS_KEY, JSON.stringify(wallets));
  return wallet;
}

/**
 * Remove a wallet from the watch list.
 */
export async function removeWatchedWallet(address: string): Promise<void> {
  const wallets = await getWatchedWallets();
  const filtered = wallets.filter(w => w.address !== address);
  await AsyncStorage.setItem(WATCHED_WALLETS_KEY, JSON.stringify(filtered));
}

/**
 * Check if a wallet is being watched.
 */
export async function isWatching(address: string): Promise<boolean> {
  const wallets = await getWatchedWallets();
  return wallets.some(w => w.address === address);
}
