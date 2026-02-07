import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as memory from './memory';
import * as api from './api';
import { parseWalletMd, parseWatchedTokens } from './walletParser';
import { getAlerts, markAlertTriggered } from './alerts';
import { sendLocalNotification } from './notifications';
import { checkDCAExecutions, markDCAExecuted } from './dca';
import { getActiveOrders, checkOrders } from './orders';
import { ensureWatching } from './priceWatcher';
import { getRecentMessages } from '../supabase/agentPark';

const HEARTBEAT_TASK = 'OPENSEEKER_HEARTBEAT';

let foregroundInterval: ReturnType<typeof setInterval> | null = null;
let lastHeartbeat: number = 0;

/**
 * Execute a single heartbeat cycle.
 */
export async function executeHeartbeat(): Promise<void> {
  try {
    // 1. Read current state from AsyncStorage
    const soul = await memory.readSoul();
    const userMemory = await memory.readMemory();
    const wallet = await memory.readWallet();

    // 2. Parse structured data
    const watchedTokens = parseWatchedTokens(userMemory);
    const portfolioTokens = parseWalletMd(wallet);
    const storedAlerts = await getAlerts();

    const alertsPayload = storedAlerts
      .filter((a) => !a.triggered)
      .map((a) => ({
        token: a.token,
        condition: a.condition,
        price: a.targetPrice,
      }));

    // 3. Call server heartbeat
    const result = await api.heartbeat({
      soul,
      memory: userMemory,
      wallet,
      watched_tokens: watchedTokens,
      alerts: alertsPayload,
      portfolio_tokens: portfolioTokens.map((h) => ({
        symbol: h.symbol,
        amount: h.amount,
        avg_entry: h.avgEntry,
      })),
    });

    // 4. Handle triggered alerts
    if (result.triggered_alerts) {
      for (const triggered of result.triggered_alerts) {
        const match = storedAlerts.find(
          (a) => a.token === triggered.token && !a.triggered,
        );
        if (match) {
          await markAlertTriggered(match.id);
        }
      }
    }

    // 5. Send notification if notable
    if (result.notify && result.message) {
      const { useSettingsStore } = await import('../stores/settingsStore');
      const notifName = useSettingsStore.getState().agentName || 'DegenCat';
      await sendLocalNotification(
        `(=^.^=) ${notifName} Alert`,
        result.message,
        { type: 'heartbeat', triggers: result.triggers },
      );
    }

    // 6. Log to daily
    const triggerStr = result.triggers?.join(', ') || '';
    await memory.appendDaily(
      `[HEARTBEAT] ${result.status}${triggerStr ? ` — ${triggerStr}` : ''}`,
    );

    // 7. Check trading orders
    try {
      const activeOrders = await getActiveOrders();
      if (activeOrders.length > 0) {
        // Build price map from watched tokens + portfolio
        const allSymbols = [...new Set(activeOrders.map((o) => o.token))];
        const orderPrices: Record<string, number> = {};
        // Try to get prices from the heartbeat result or fetch them
        for (const symbol of allSymbols) {
          try {
            const serverUrl = (await import('../stores/settingsStore')).useSettingsStore.getState().serverUrl;
            const res = await fetch(`${serverUrl}/price/${symbol.toLowerCase()}`);
            if (res.ok) {
              const data = await res.json();
              orderPrices[symbol.toUpperCase()] = data.price;
            }
          } catch {}
        }
        if (Object.keys(orderPrices).length > 0) {
          const triggered = await checkOrders(orderPrices);
          for (const order of triggered) {
            await memory.appendDaily(
              `[HEARTBEAT] Order triggered: ${order.type} ${order.token} @ $${order.triggerPrice}`,
            );
          }
        }
        // Ensure price watcher is running for faster checks
        ensureWatching().catch(console.error);
      }
    } catch (orderErr) {
      console.log('[Heartbeat] Order check error:', orderErr);
    }

    // 8. Check DCA automations
    try {
      const dueDCAs = await checkDCAExecutions();
      for (const dca of dueDCAs) {
        await memory.appendDaily(
          `[DCA] Would execute: ${dca.amount} ${dca.fromToken} → ${dca.toToken} (log-only)`,
        );
        await markDCAExecuted(dca.id);
        await sendLocalNotification(
          '🔄 DCA Executed',
          `${dca.amount} ${dca.fromToken} → ${dca.toToken} (simulated)`,
          { type: 'dca', configId: dca.id },
        );
      }
    } catch (dcaErr) {
      console.log('[Heartbeat] DCA check error:', dcaErr);
    }

    // 9. Check Agent Park
    try {
      const { useSettingsStore } = await import('../stores/settingsStore');
      const { parkMode, parkTopics, agentName } = useSettingsStore.getState();

      if (parkMode !== 'off') {
        const recentMessages = await getRecentMessages(20);
        if (recentMessages.length > 0) {
          const parkSummary = recentMessages
            .slice(-5)
            .map((m) => `${m.agent_profiles?.agent_name || 'Unknown'}: ${m.content}`)
            .join(' | ');
          await memory.appendDaily(
            `[PARK] ${recentMessages.length} recent messages. Latest: ${parkSummary.slice(0, 200)}`,
          );
        }
      }
    } catch (parkErr) {
      console.log('[Heartbeat] Park check error:', parkErr);
    }

    lastHeartbeat = Date.now();
  } catch (error) {
    console.log('[Heartbeat] Error:', error);
  }
}

/**
 * Register the background fetch task.
 */
export async function registerBackgroundHeartbeat(): Promise<void> {
  // Define the task
  TaskManager.defineTask(HEARTBEAT_TASK, async () => {
    try {
      await executeHeartbeat();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  // Register with system
  try {
    await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK, {
      minimumInterval: 30 * 60, // 30 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('[Heartbeat] Background task registered');
  } catch (error) {
    console.log('[Heartbeat] Background registration failed:', error);
  }
}

/**
 * Start foreground heartbeat interval (backup for when background fetch is unreliable).
 */
export function startForegroundHeartbeat(intervalMs: number = 30 * 60 * 1000): void {
  stopForegroundHeartbeat();
  foregroundInterval = setInterval(() => {
    executeHeartbeat().catch(console.error);
  }, intervalMs);
  console.log(`[Heartbeat] Foreground interval started (${intervalMs / 1000}s)`);
}

/**
 * Stop the foreground heartbeat interval.
 */
export function stopForegroundHeartbeat(): void {
  if (foregroundInterval) {
    clearInterval(foregroundInterval);
    foregroundInterval = null;
  }
}

/**
 * Unregister the background heartbeat task.
 */
export async function unregisterBackgroundHeartbeat(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(HEARTBEAT_TASK);
  } catch {
    // task may not be registered
  }
  stopForegroundHeartbeat();
}

/**
 * Get the timestamp of the last heartbeat execution.
 */
export function getLastHeartbeat(): number {
  return lastHeartbeat;
}
