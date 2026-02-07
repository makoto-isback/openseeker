/**
 * On-Chain Portfolio Service — Fetches real wallet holdings from Solana RPC.
 * Replaces WALLET.md parsing with actual on-chain data.
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_MINTS } from '../constants/tokenMints';
import { useSettingsStore } from '../stores/settingsStore';

export interface TokenBalance {
  symbol: string;
  mint: string;
  amount: number;
  decimals: number;
  usdPrice: number;
  usdValue: number;
  change24h: number;
}

export interface PortfolioData {
  sol: number;
  solUsdPrice: number;
  solUsdValue: number;
  solChange24h: number;
  tokens: TokenBalance[];
  totalUsd: number;
}

let cachedData: PortfolioData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30s

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Fetch real on-chain holdings for a wallet address.
 */
export async function fetchOnChainHoldings(
  address: string,
  connection: Connection,
): Promise<PortfolioData> {
  // Return cache if fresh
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  const publicKey = new PublicKey(address);
  const serverUrl = useSettingsStore.getState().serverUrl;

  // Fetch SOL balance and SPL token accounts in parallel
  const [solLamports, tokenAccounts] = await Promise.all([
    connection.getBalance(publicKey),
    connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    }),
  ]);

  const solBalance = solLamports / LAMPORTS_PER_SOL;

  // Parse SPL token balances
  const splTokens: TokenBalance[] = [];
  for (const account of tokenAccounts.value) {
    const parsed = account.account.data.parsed?.info;
    if (!parsed) continue;

    const mint = parsed.mint as string;
    const amount = parsed.tokenAmount?.uiAmount as number;
    const decimals = parsed.tokenAmount?.decimals as number;

    // Skip zero balances
    if (!amount || amount === 0) continue;

    const symbol = TOKEN_MINTS[mint] || `${mint.slice(0, 4)}...${mint.slice(-4)}`;

    splTokens.push({
      symbol,
      mint,
      amount,
      decimals,
      usdPrice: 0,
      usdValue: 0,
      change24h: 0,
    });
  }

  // Fetch prices for SOL + all known tokens
  let solPrice = 0;
  let solChange = 0;

  try {
    const res = await fetch(`${serverUrl}/price/sol?detailed=true`, {
      signal: timeoutSignal(5000),
    });
    if (res.ok) {
      const data = await res.json();
      solPrice = data.price || 0;
      solChange = data.change_24h || 0;
    }
  } catch {}

  // Fetch prices for SPL tokens
  for (const token of splTokens) {
    // Only fetch prices for known tokens
    if (TOKEN_MINTS[token.mint]) {
      try {
        const res = await fetch(
          `${serverUrl}/price/${token.symbol.toLowerCase()}?detailed=true`,
          { signal: timeoutSignal(5000) },
        );
        if (res.ok) {
          const data = await res.json();
          token.usdPrice = data.price || 0;
          token.usdValue = token.amount * token.usdPrice;
          token.change24h = data.change_24h || 0;
        }
      } catch {}
    }
  }

  const solUsdValue = solBalance * solPrice;
  const tokensUsdValue = splTokens.reduce((sum, t) => sum + t.usdValue, 0);

  const result: PortfolioData = {
    sol: solBalance,
    solUsdPrice: solPrice,
    solUsdValue,
    solChange24h: solChange,
    tokens: splTokens,
    totalUsd: solUsdValue + tokensUsdValue,
  };

  // Cache
  cachedData = result;
  cacheTimestamp = Date.now();

  return result;
}

/**
 * Build a wallet context string for the AI from on-chain holdings.
 * e.g. "User holds: 2.5 SOL ($435), 1000 BONK ($0.02)"
 */
export function buildWalletContext(data: PortfolioData): string {
  const parts: string[] = [];

  if (data.sol > 0) {
    parts.push(`${data.sol.toFixed(4)} SOL ($${data.solUsdValue.toFixed(2)})`);
  }

  for (const t of data.tokens) {
    if (t.usdValue > 0.01) {
      parts.push(`${t.amount} ${t.symbol} ($${t.usdValue.toFixed(2)})`);
    } else if (t.amount > 0) {
      parts.push(`${t.amount} ${t.symbol}`);
    }
  }

  if (parts.length === 0) {
    return 'User has no holdings.';
  }

  return `User holds: ${parts.join(', ')}. Total: $${data.totalUsd.toFixed(2)}`;
}

/**
 * Clear the portfolio cache (call after swaps/transfers).
 */
export function clearPortfolioCache(): void {
  cachedData = null;
  cacheTimestamp = 0;
}
