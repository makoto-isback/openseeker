/**
 * Swap Service — Real Jupiter Swaps via Embedded Wallet
 *
 * Handles the complete swap flow:
 * 1. Server gets quote from Jupiter
 * 2. Server creates unsigned transaction
 * 3. App signs with embedded wallet keypair (no popup)
 * 4. Transaction is sent on-chain
 */
import { Buffer } from 'buffer';
import { useWalletStore, signAndSendTransaction } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { paidFetch } from './x402';
import { addXP } from './gamification';
import { updateHolding, recordTrade } from './walletManager';

export interface SwapQuote {
  from: { symbol: string; amount: number };
  to: { symbol: string; amount: number };
  rate: number;
  priceImpact: number;
  minReceived: number;
  slippage: string;
  route: string;
  source: string;
  rawQuote?: any; // Full quote for transaction creation
}

export interface SwapResult {
  success: boolean;
  txSignature: string;
  fromSymbol: string;
  fromAmount: number;
  toSymbol: string;
  toAmount: number;
  timestamp: number;
  source: string;
  solscanUrl?: string;
}

/**
 * Get a swap quote from the server (which calls Jupiter).
 */
export async function getSwapQuote(
  fromSymbol: string,
  toSymbol: string,
  amount: number
): Promise<SwapQuote> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  const res = await paidFetch(`${serverUrl}/swap/swap-quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromSymbol,
      to: toSymbol,
      amount,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Quote failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    from: data.quote.from,
    to: data.quote.to,
    rate: data.quote.rate,
    priceImpact: data.quote.price_impact,
    minReceived: data.quote.min_received,
    slippage: data.quote.slippage,
    route: data.quote.route,
    source: data.quote.source,
    rawQuote: data.rawResponse, // Keep for transaction
  };
}

/**
 * Execute a swap — the main function for real on-chain swaps.
 *
 * Flow:
 * 1. Check wallet is connected
 * 2. Get swap transaction from server
 * 3. Sign and send with embedded wallet (no popup)
 * 4. Return transaction signature
 */
export async function executeSwap(data: {
  from: { symbol: string; amount: number };
  to: { symbol: string; amount: number };
  rawQuote?: any;
  source?: string;
}): Promise<SwapResult> {
  const { address, isConnected } = useWalletStore.getState();
  const serverUrl = useSettingsStore.getState().serverUrl;

  // Check wallet connection
  if (!isConnected || !address) {
    // Fallback to simulated swap if no wallet
    console.log('[SWAP] No wallet connected, using simulated swap');
    return executeSimulatedSwap(data);
  }

  console.log(`[SWAP] Executing real swap: ${data.from.amount} ${data.from.symbol} → ${data.to.symbol}`);

  try {
    // Step 1: Get the swap transaction from server
    const txRes = await paidFetch(`${serverUrl}/swap/swap-execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: data.rawQuote,
        userPublicKey: address,
      }),
    });

    if (!txRes.ok) {
      const error = await txRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Swap transaction failed: ${txRes.status}`);
    }

    const txData = await txRes.json();

    // Check if this is a mock transaction
    if (txData.transaction?.source === 'mock' || !txData.transaction?.swapTransaction) {
      console.log('[SWAP] Mock transaction received, using simulated swap');
      return executeSimulatedSwap(data);
    }

    // Step 2: Decode the base64 transaction
    const swapTransactionBase64 = txData.transaction.swapTransaction;
    const transactionBuffer = Buffer.from(swapTransactionBase64, 'base64');

    console.log(`[SWAP] Transaction size: ${transactionBuffer.length} bytes`);

    // Step 3: Sign and send with embedded wallet
    console.log('[SWAP] Signing transaction...');
    const txSignature = await signAndSendTransaction(new Uint8Array(transactionBuffer));

    console.log(`[SWAP] Transaction confirmed: ${txSignature}`);

    // Step 4: Award XP and update wallet
    const xpAmount = data.from.amount >= 100 ? 10 : 5;
    addXP(xpAmount).catch(console.error);

    // Update WALLET.md
    try {
      const toPrice = data.from.amount / data.to.amount;
      await recordTrade('SWAP', data.to.symbol, data.to.amount, toPrice, txSignature);
      await updateHolding(data.to.symbol, data.to.amount, toPrice);
    } catch (err) {
      console.error('[SWAP] Failed to update WALLET.md:', err);
    }

    // Refresh wallet balance
    useWalletStore.getState().refreshBalance();

    return {
      success: true,
      txSignature,
      fromSymbol: data.from.symbol,
      fromAmount: data.from.amount,
      toSymbol: data.to.symbol,
      toAmount: data.to.amount,
      timestamp: Date.now(),
      source: 'jupiter',
      solscanUrl: `https://solscan.io/tx/${txSignature}`,
    };
  } catch (error: any) {
    console.error('[SWAP] Error:', error.message);
    throw error;
  }
}

/**
 * Simulated swap for demos when wallet isn't connected.
 * Generates a fake transaction signature.
 */
async function executeSimulatedSwap(data: {
  from: { symbol: string; amount: number };
  to: { symbol: string; amount: number };
  source?: string;
}): Promise<SwapResult> {
  // Simulate signing delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Generate fake transaction signature
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let sig = '';
  for (let i = 0; i < 88; i++) {
    sig += chars[Math.floor(Math.random() * chars.length)];
  }

  // Award XP
  const xpAmount = data.from.amount >= 100 ? 10 : 5;
  addXP(xpAmount).catch(console.error);

  // Update WALLET.md
  try {
    const toPrice = data.from.amount / data.to.amount;
    await recordTrade('SWAP', data.to.symbol, data.to.amount, toPrice, sig);
    await updateHolding(data.to.symbol, data.to.amount, toPrice);
  } catch (err) {
    console.error('[SWAP] Failed to update WALLET.md:', err);
  }

  return {
    success: true,
    txSignature: sig,
    fromSymbol: data.from.symbol,
    fromAmount: data.from.amount,
    toSymbol: data.to.symbol,
    toAmount: data.to.amount,
    timestamp: Date.now(),
    source: 'simulated',
  };
}

/**
 * Check if real swaps are available (wallet connected).
 */
export function canExecuteRealSwap(): boolean {
  const { isConnected, address } = useWalletStore.getState();
  return isConnected && !!address;
}
