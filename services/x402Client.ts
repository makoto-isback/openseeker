/**
 * x402 Standard Client for React Native
 *
 * Wraps fetch() to handle HTTP 402 responses from x402-enabled endpoints.
 * When server returns 402, the client auto-creates a USDC transfer,
 * signs it with the embedded/Privy wallet, and retries with PAYMENT-SIGNATURE header.
 *
 * This is the x402 standard protocol (solana.com/x402):
 * 1. Client sends request
 * 2. Server responds 402 with payment requirements
 * 3. Client builds USDC transfer → signs → retries with payment header
 * 4. Server verifies via PayAI facilitator → serves response
 */
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';

interface X402PaymentInfo {
  paid: boolean;
  free: boolean;
  freeRemaining?: number;
  amount?: string;
  legacy?: boolean;
}

interface X402Response extends Response {
  x402Info?: X402PaymentInfo;
}

// Safety limits
const MAX_PAYMENT_USDC = 0.01; // $0.01 max per request

/**
 * Fetch wrapper that handles x402 payment-required responses.
 *
 * Payment flow:
 * 1. If wallet has free messages → server passes through, no payment needed
 * 2. If server returns 402 → check if we can auto-pay via legacy credit system
 * 3. Future: auto-build USDC transfer and retry with PAYMENT-SIGNATURE
 *
 * For now, the primary flow uses:
 * - Free messages (first 100) for new users
 * - Legacy credit system (X-Wallet header) for funded users
 * - Standard 402 for external agents (they handle their own payments)
 */
export async function x402Fetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const { address } = useWalletStore.getState();

  try {
    // Build headers — always include X-Wallet for free message + legacy credit support
    const headers: Record<string, string> = {
      ...Object.fromEntries(new Headers(options.headers).entries()),
    };

    if (address && address.length >= 32) {
      headers['X-Wallet'] = address;
    }

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });

    // Not a 402 — return normally
    if (res.status !== 402) {
      return res;
    }

    // Got 402 — parse payment requirements
    const body = await res.json();

    // Check if this is an x402 standard 402 response
    if (body.x402Version || body.accepts) {
      // Standard x402 response — for now, surface as insufficient credits
      // In future: auto-build USDC payment and retry
      const price = body.accepts?.[0]?.maxAmountRequired;
      const priceUsdc = price ? (parseInt(price) / 1_000_000).toFixed(4) : 'unknown';

      throw new Error(
        `Payment required: $${priceUsdc} USDC. ` +
        `Free messages exhausted. Deposit USDC to continue.`
      );
    }

    // Legacy 402 response (credit system)
    if (body.message === 'Insufficient balance') {
      throw new Error(
        `Insufficient balance ($${body.balance?.toFixed(4) || '0'}). ` +
        `Need $${body.price?.toFixed(4)}. ` +
        `Deposit USDC to continue.`
      );
    }

    throw new Error(body.message || 'Payment required');
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
 * Extract x402 payment info from a chat response.
 * The server includes `x402` field when x402Gate middleware is active.
 */
export function parseX402Info(responseData: any): X402PaymentInfo | null {
  if (!responseData?.x402) return null;
  return responseData.x402 as X402PaymentInfo;
}
