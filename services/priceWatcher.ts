/**
 * Price Watcher — Fast polling for active trading orders.
 *
 * Polls CoinGecko every 60s when active orders exist.
 * Automatically stops when no active orders remain.
 * Calls checkOrders() to trigger fills.
 */
import { useSettingsStore } from '../stores/settingsStore';
import { getActiveOrders, checkOrders } from './orders';

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

let watcherInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Fetch prices for given symbols from the server's free price endpoint.
 */
async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  const prices: Record<string, number> = {};

  // Fetch in parallel
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`${serverUrl}/price/${symbol.toLowerCase()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          return { symbol: symbol.toUpperCase(), price: data.price };
        }
      } finally {
        clearTimeout(timeout);
      }
      return null;
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      prices[result.value.symbol] = result.value.price;
    }
  }

  return prices;
}

/**
 * Run one cycle: fetch prices for all active orders and check triggers.
 */
async function runCycle(): Promise<void> {
  try {
    const activeOrders = await getActiveOrders();

    // No active orders — stop watching
    if (activeOrders.length === 0) {
      console.log('[PriceWatcher] No active orders, stopping');
      stop();
      return;
    }

    // Gather unique tokens to check
    const symbols = [...new Set(activeOrders.map((o) => o.token))];
    console.log(`[PriceWatcher] Checking ${symbols.join(', ')} (${activeOrders.length} orders)`);

    // Fetch prices
    const prices = await fetchPrices(symbols);

    // Check orders against prices
    const triggered = await checkOrders(prices);
    if (triggered.length > 0) {
      console.log(`[PriceWatcher] Triggered ${triggered.length} orders`);
    }
  } catch (err) {
    console.log('[PriceWatcher] Cycle error:', err);
  }
}

/**
 * Start the price watcher. Runs immediately then every POLL_INTERVAL_MS.
 * No-op if already running.
 */
export function start(): void {
  if (isRunning) return;
  isRunning = true;

  console.log(`[PriceWatcher] Started (${POLL_INTERVAL_MS / 1000}s interval)`);

  // Run immediately
  runCycle().catch(console.error);

  // Then on interval
  watcherInterval = setInterval(() => {
    runCycle().catch(console.error);
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the price watcher.
 */
export function stop(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
  isRunning = false;
  console.log('[PriceWatcher] Stopped');
}

/**
 * Check if watcher is currently running.
 */
export function isWatching(): boolean {
  return isRunning;
}

/**
 * Ensure the watcher is running if there are active orders.
 * Call this after creating a new order.
 */
export async function ensureWatching(): Promise<void> {
  const activeOrders = await getActiveOrders();
  if (activeOrders.length > 0 && !isRunning) {
    start();
  }
}
