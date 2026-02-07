import { useSettingsStore } from '../stores/settingsStore';
import { useWalletStore } from '../stores/walletStore';

interface PaymentError {
  status: 402;
  message: string;
  balance?: number;
  price?: number;
  shortfall?: number;
  deposit_address?: string;
}

/**
 * Fetch wrapper that handles x402 credit-based payments.
 *
 * New flow (credit mode):
 * - Sends X-Wallet header with every request
 * - Server checks balance and deducts if sufficient
 * - No more 402-retry dance for funded users (single request!)
 *
 * Fallback (test mode):
 * - If no wallet connected, falls back to test:{wallet}:{timestamp}
 * - Only works if server has X402_MODE=test
 */
export async function paidFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const { address } = useWalletStore.getState();

  try {
    // Build headers
    const headers: Record<string, string> = {
      ...Object.fromEntries(new Headers(options.headers).entries()),
    };

    // If wallet is connected, use credit mode (X-Wallet header)
    // Otherwise, use test mode fallback (X-Payment header)
    if (address && address.length >= 32) {
      headers['X-Wallet'] = address;
    } else {
      // Test mode fallback for demos
      const testWallet = 'TestWallet1111111111111111111111111111111111';
      headers['X-Payment'] = `test:${testWallet}:${Date.now()}`;
    }

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });

    // Handle 402 Payment Required
    if (res.status === 402) {
      const errorInfo = await res.json();

      // x402 standard 402 response (has x402Version or accepts array)
      if (errorInfo.x402Version || errorInfo.accepts) {
        const price = errorInfo.accepts?.[0]?.maxAmountRequired;
        const priceUsdc = price ? (parseInt(price) / 1_000_000).toFixed(4) : 'unknown';
        throw new Error(
          `Payment required: $${priceUsdc} USDC. ` +
          `Free messages exhausted. Deposit USDC to continue.`
        );
      }

      // Legacy 402 response (credit system)
      if (errorInfo.message === 'Insufficient balance') {
        throw new Error(
          `Insufficient balance ($${errorInfo.balance?.toFixed(4) || '0'}). ` +
          `Need $${errorInfo.price?.toFixed(4)}. ` +
          `Deposit USDC to continue.`
        );
      }

      if (errorInfo.message?.includes('test')) {
        throw new Error('Test mode not available. Connect wallet and deposit USDC.');
      }

      throw new Error(errorInfo.message || 'Payment required');
    }

    return res;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running?');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if the app is in test mode (no real wallet connected).
 */
export function isTestMode(): boolean {
  const { address } = useWalletStore.getState();
  return !address || address.length < 32;
}
