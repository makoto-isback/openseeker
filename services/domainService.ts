import { useSettingsStore } from '../stores/settingsStore';
import { useWalletStore, signAndSendTransaction, RPC_ENDPOINTS, CLUSTER } from '../stores/walletStore';

interface DomainCheckResult {
  available: boolean;
  name: string;
  domain: string;
  tier?: string;
  price?: number;
  tierInfo?: any;
  owner?: string;
  error?: string;
}

interface DomainInfo {
  domain: string | null;
  verified: boolean;
  tier?: string;
  expiresAt?: string;
  verifiedAt?: string;
}

interface RegisterResult {
  success: boolean;
  domain?: string;
  tier?: string;
  expiresAt?: string;
  error?: string;
  testMode?: boolean;
}

interface LookupResult {
  domain: string;
  wallet: string;
  agent?: {
    name: string;
    tier: string;
    verified: boolean;
    level?: number;
    winRate?: number;
    trades?: number;
  };
}

function getServerUrl(): string {
  return useSettingsStore.getState().serverUrl;
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Check if a .os domain name is available */
export async function checkDomain(name: string): Promise<DomainCheckResult> {
  const serverUrl = getServerUrl();
  try {
    const res = await fetch(`${serverUrl}/api/domains/check/${encodeURIComponent(name)}`, {
      signal: timeoutSignal(5000),
    });
    return await res.json();
  } catch (error: any) {
    return { available: false, name, domain: `${name}.os`, error: error.message };
  }
}

/** Get price for a domain name */
export async function getDomainPrice(name: string) {
  const serverUrl = getServerUrl();
  try {
    const res = await fetch(`${serverUrl}/api/domains/price/${encodeURIComponent(name)}`, {
      signal: timeoutSignal(5000),
    });
    return await res.json();
  } catch (error: any) {
    return { error: error.message };
  }
}

/** Register a .os domain — full flow with SOL payment */
export async function registerDomain(name: string): Promise<RegisterResult> {
  const { address, isConnected } = useWalletStore.getState();
  if (!isConnected || !address) {
    return { success: false, error: 'Wallet not connected' };
  }

  // 1. Check availability & get price
  const check = await checkDomain(name);
  if (!check.available) {
    return { success: false, error: check.error || 'Domain is not available' };
  }

  const price = check.price || 0.1;
  const serverUrl = getServerUrl();

  // 2. Get treasury wallet from price endpoint
  let treasury: string;
  try {
    const priceRes = await fetch(`${serverUrl}/api/domains/price/${encodeURIComponent(name)}`, {
      signal: timeoutSignal(5000),
    });
    const priceData = await priceRes.json();
    treasury = priceData.treasury;
  } catch {
    return { success: false, error: 'Failed to get treasury address' };
  }

  // 3. Build and send SOL transfer transaction
  let txSignature: string;
  try {
    const {
      Transaction: Tx,
      SystemProgram,
      PublicKey: PK,
      Connection: Conn,
      LAMPORTS_PER_SOL: LAMPORTS,
    } = require('@solana/web3.js');

    const rpcUrl = RPC_ENDPOINTS[CLUSTER as keyof typeof RPC_ENDPOINTS];
    const connection = new Conn(rpcUrl, 'confirmed');

    const transaction = new Tx().add(
      SystemProgram.transfer({
        fromPubkey: new PK(address),
        toPubkey: new PK(treasury),
        lamports: Math.round(price * LAMPORTS),
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PK(address);

    txSignature = await signAndSendTransaction(transaction);
  } catch (error: any) {
    // If we can't do on-chain, try test mode
    if (error.message?.includes('simulated') || error.message?.includes('insufficient')) {
      return { success: false, error: `Insufficient SOL balance. Need ${price} SOL for ${name}.os` };
    }
    // Fallback to test_simulation for dev
    txSignature = 'test_simulation';
  }

  // 4. Register with server
  try {
    const res = await fetch(`${serverUrl}/api/domains/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, wallet: address, txSignature }),
      signal: timeoutSignal(15000),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    // 5. Update local settings store
    useSettingsStore.getState().setDomainInfo(data.domain, data.tier, data.expiresAt);

    return {
      success: true,
      domain: data.domain,
      tier: data.tier,
      expiresAt: data.expiresAt,
      testMode: data.testMode,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Get domain info for current wallet */
export async function getMyDomain(): Promise<DomainInfo> {
  const { address } = useWalletStore.getState();
  if (!address) return { domain: null, verified: false };

  const serverUrl = getServerUrl();
  try {
    const res = await fetch(`${serverUrl}/api/domains/my/${address}`, {
      signal: timeoutSignal(5000),
    });
    return await res.json();
  } catch {
    return { domain: null, verified: false };
  }
}

/** Look up a .os domain */
export async function lookupDomain(domain: string): Promise<LookupResult | null> {
  const serverUrl = getServerUrl();
  try {
    const res = await fetch(`${serverUrl}/api/domains/lookup/${encodeURIComponent(domain)}`, {
      signal: timeoutSignal(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
