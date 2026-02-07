import { useSettingsStore } from '../stores/settingsStore';
import { useWalletStore, signAndSendTransaction, RPC_ENDPOINTS, CLUSTER } from '../stores/walletStore';

/** Create an AbortSignal that times out after `ms` milliseconds (React Native compatible). */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface BalanceInfo {
  wallet: string;
  balance: number;
  total_deposited: number;
  total_spent: number;
  usage_today: number;
  usage_month: number;
  requests_today: number;
  requests_month: number;
  exists: boolean;
}

export interface DepositAddress {
  deposit_address: string;
  usdc_mint: string;
  network: string;
  minimum_deposit: number;
  instructions: string[];
}

export interface DepositResult {
  success: boolean;
  credited?: number;
  new_balance?: number;
  error?: string;
  test_mode?: boolean;
}

/**
 * Fetch user's balance from the server.
 */
export async function fetchBalance(wallet?: string): Promise<BalanceInfo | null> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  const address = wallet || useWalletStore.getState().address;

  if (!address || address.length < 32) {
    return null;
  }

  try {
    const res = await fetch(`${serverUrl}/balance/${address}`, {
      signal: timeoutSignal(5000),
    });

    if (!res.ok) {
      console.error('[Balance] Fetch failed:', res.status);
      return null;
    }

    return await res.json();
  } catch (error: any) {
    console.error('[Balance] Error:', error.message);
    return null;
  }
}

/**
 * Get the server's USDC deposit address and instructions.
 */
export async function getDepositAddress(): Promise<DepositAddress | null> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  try {
    const res = await fetch(`${serverUrl}/deposit/address`, {
      signal: timeoutSignal(5000),
    });

    if (!res.ok) {
      console.error('[Deposit] Get address failed:', res.status);
      return null;
    }

    return await res.json();
  } catch (error: any) {
    console.error('[Deposit] Error:', error.message);
    return null;
  }
}

/**
 * Verify a deposit transaction and credit the balance.
 */
export async function checkDeposit(txSignature: string): Promise<DepositResult> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  const wallet = useWalletStore.getState().address;

  if (!wallet) {
    return { success: false, error: 'Wallet not connected' };
  }

  try {
    const res = await fetch(`${serverUrl}/deposit/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, tx_signature: txSignature }),
      signal: timeoutSignal(30000), // Long timeout for RPC
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || 'Deposit check failed' };
    }

    return {
      success: true,
      credited: data.credited,
      new_balance: data.new_balance,
    };
  } catch (error: any) {
    console.error('[Deposit] Check error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Credit test balance (only works in test mode).
 */
export async function creditTestBalance(amount: number): Promise<DepositResult> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  const wallet = useWalletStore.getState().address || 'TestWallet1111111111111111111111111111111111';

  try {
    const res = await fetch(`${serverUrl}/deposit/credit-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, amount }),
      signal: timeoutSignal(5000),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || 'Test credit failed' };
    }

    return {
      success: true,
      credited: data.credited,
      new_balance: data.new_balance,
      test_mode: true,
    };
  } catch (error: any) {
    console.error('[Deposit] Test credit error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get current SOL price from the server's price endpoint.
 */
export async function getSOLPrice(): Promise<number> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  try {
    const res = await fetch(`${serverUrl}/price/sol`, {
      signal: timeoutSignal(5000),
    });
    const data = await res.json();
    return data.price || 180;
  } catch {
    return 180; // fallback
  }
}

/**
 * Deposit SOL — builds transfer, signs with embedded wallet, confirms, credits balance.
 */
export async function depositSOL(
  amountSOL: number
): Promise<DepositResult & { sol_amount?: number; usd_credited?: number }> {
  const { address } = useWalletStore.getState();
  if (!address) {
    return { success: false, error: 'Wallet not connected' };
  }

  if (amountSOL <= 0) {
    return { success: false, error: 'Amount must be greater than 0' };
  }

  const serverUrl = useSettingsStore.getState().serverUrl;
  console.log('[Deposit] Starting SOL deposit:', amountSOL, 'SOL from', address);

  // 1. Get deposit address from server
  let depositInfo: any;
  try {
    console.log('[Deposit] Step 1: Fetching deposit address from', serverUrl);
    const res = await fetch(`${serverUrl}/deposit/address`, {
      signal: timeoutSignal(5000),
    });
    depositInfo = await res.json();
    console.log('[Deposit] Got deposit address:', depositInfo.deposit_address);
  } catch (error: any) {
    console.error('[Deposit] Step 1 FAILED:', error.message);
    return { success: false, error: 'Failed to get deposit address from server' };
  }

  // 2. Build SOL transfer transaction
  let transaction: any;
  let connection: any;
  try {
    console.log('[Deposit] Step 2: Building transaction...');
    const {
      Transaction: Tx,
      SystemProgram,
      PublicKey: PK,
      Connection: Conn,
      LAMPORTS_PER_SOL: LAMPORTS,
    } = require('@solana/web3.js');

    const rpcUrl = RPC_ENDPOINTS[CLUSTER as keyof typeof RPC_ENDPOINTS];
    console.log('[Deposit] RPC:', rpcUrl);
    connection = new Conn(rpcUrl, 'confirmed');

    transaction = new Tx().add(
      SystemProgram.transfer({
        fromPubkey: new PK(address),
        toPubkey: new PK(depositInfo.deposit_address),
        lamports: Math.round(amountSOL * LAMPORTS),
      })
    );

    console.log('[Deposit] Getting blockhash...');
    const { blockhash } = await connection.getLatestBlockhash();
    console.log('[Deposit] Blockhash:', blockhash.slice(0, 16) + '...');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PK(address);

    console.log('[Deposit] Step 3: Transaction built successfully');
  } catch (error: any) {
    console.error('[Deposit] Step 2-3 FAILED:', error.message);
    return { success: false, error: 'Failed to build transaction: ' + error.message };
  }

  // 4. Sign and send with embedded wallet
  let txSignature: string;
  try {
    console.log('[Deposit] Step 4: Signing transaction...');
    txSignature = await signAndSendTransaction(transaction);
    console.log('[Deposit] Step 4: Transaction signed! Sig:', txSignature.slice(0, 16) + '...');
  } catch (error: any) {
    const msg = error.message || 'Transaction failed';
    console.error('[Deposit] Step 4 FAILED:', msg);
    return { success: false, error: msg };
  }

  // 4. Wait for confirmation
  try {
    await connection.confirmTransaction(txSignature, 'confirmed');
  } catch (error: any) {
    return { success: false, error: 'Transaction confirmation timed out. It may still succeed — check your balance.' };
  }

  // 5. Tell server to verify and credit
  try {
    const res = await fetch(`${serverUrl}/deposit/check-sol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address, tx_signature: txSignature }),
      signal: timeoutSignal(30000),
    });

    const result = await res.json();

    // 6. Refresh wallet SOL balance
    useWalletStore.getState().refreshBalance();

    if (!res.ok) {
      return { success: false, error: result.error || 'Server verification failed' };
    }

    return {
      success: true,
      credited: result.usd_credited,
      new_balance: result.new_balance,
      sol_amount: result.sol_amount,
      usd_credited: result.usd_credited,
    };
  } catch (error: any) {
    // Still refresh balance since SOL was sent
    useWalletStore.getState().refreshBalance();
    return { success: false, error: error.message || 'Failed to verify deposit' };
  }
}

/**
 * Format a balance for display.
 */
export function formatBalance(balance: number): string {
  if (balance >= 1) {
    return `$${balance.toFixed(2)}`;
  }
  return `$${balance.toFixed(4)}`;
}
