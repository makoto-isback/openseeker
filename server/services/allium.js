/**
 * Allium Blockchain Data Service
 *
 * Enterprise-grade on-chain data via Allium's Developer API.
 * Used by Phantom, Uniswap, Coinbase — now powering OpenSeeker.
 *
 * Base URL: https://api.allium.so/api/v1/developer
 * Auth: X-API-KEY header
 * Docs: https://docs.allium.so
 *
 * ADDITIVE integration — all functions gracefully fallback on failure.
 */
const { getCached, setCache } = require('../utils/cache');
const { MINT_MAP } = require('./jupiter');

const BASE_URL = 'https://api.allium.so/api/v1/developer';
const API_KEY = process.env.ALLIUM_API_KEY || '';

// Log init status
if (API_KEY) {
  console.log(`[Allium] API key configured (${API_KEY.slice(0, 8)}...)`);
} else {
  console.warn('[Allium] No ALLIUM_API_KEY set — Allium features will use fallback data');
}

/**
 * Internal fetch helper with timeout + auth.
 */
async function alliumFetch(path, body, queryParams = {}, timeoutMs = 10000) {
  if (!API_KEY) return null;

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[Allium] ${path} returned ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[Allium] ${path} timed out after ${timeoutMs}ms`);
    } else {
      console.warn(`[Allium] ${path} failed: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a token symbol to its Solana mint address.
 */
function resolveTokenAddress(symbolOrAddress) {
  if (!symbolOrAddress) return null;
  // If it looks like a full address (32+ chars), use as-is
  if (symbolOrAddress.length >= 32) return symbolOrAddress;
  // Otherwise try MINT_MAP lookup
  const sym = symbolOrAddress.toUpperCase();
  return MINT_MAP[sym] || null;
}

// ═══════════════════════════════════════
// PUBLIC API FUNCTIONS
// ═══════════════════════════════════════

/**
 * Get latest token prices from Allium.
 * @param {Array<{symbol?: string, address?: string}>} tokens
 * @returns {Object|null} Price data or null on failure
 */
async function getLatestPrices(tokens) {
  const cacheKey = `allium_prices_${tokens.map(t => t.symbol || t.address).join(',')}`;
  const cached = getCached(cacheKey, 30000); // 30s cache
  if (cached) return cached;

  const addresses = tokens.map(t => {
    const addr = t.address || resolveTokenAddress(t.symbol);
    return addr ? { chain: 'solana', token_address: addr } : null;
  }).filter(Boolean);

  if (addresses.length === 0) return null;

  const result = await alliumFetch('/prices', addresses);
  if (!result?.items) return null;

  // Map results back to symbols for easier consumption
  const priceMap = {};
  for (const item of result.items) {
    // Find original token info
    const token = tokens.find(t => {
      const addr = t.address || resolveTokenAddress(t.symbol);
      return addr === item.address;
    });
    const key = token?.symbol?.toUpperCase() || item.address;
    priceMap[key] = {
      price: item.price,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      timestamp: item.timestamp,
      source: 'allium',
    };
  }

  setCache(cacheKey, priceMap);
  return priceMap;
}

/**
 * Get historical price data for a token.
 * @param {string} symbolOrAddress - Token symbol or mint address
 * @param {string} timeframe - '1h', '24h', '7d', '30d'
 * @param {string} granularity - '5m', '1h', '1d' (auto-selected if not provided)
 * @returns {Object|null} Price history or null on failure
 */
async function getPriceHistory(symbolOrAddress, timeframe = '24h', granularity) {
  const address = resolveTokenAddress(symbolOrAddress);
  if (!address) return null;

  const cacheKey = `allium_history_${address}_${timeframe}`;
  const cached = getCached(cacheKey, 60000); // 1min cache
  if (cached) return cached;

  // Calculate time range
  const now = new Date();
  const timeRanges = {
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const range = timeRanges[timeframe] || timeRanges['24h'];
  const start = new Date(now.getTime() - range);

  // Auto-select granularity based on timeframe
  if (!granularity) {
    if (timeframe === '1h') granularity = '5m';
    else if (timeframe === '4h') granularity = '5m';
    else if (timeframe === '24h') granularity = '1h';
    else if (timeframe === '7d') granularity = '1h';
    else granularity = '1d';
  }

  const body = {
    start_timestamp: start.toISOString(),
    end_timestamp: now.toISOString(),
    addresses: [{ chain: 'solana', token_address: address }],
    time_granularity: granularity,
  };

  const result = await alliumFetch('/prices/history', body);
  if (!result?.items?.[0]) return null;

  const item = result.items[0];
  const prices = (item.prices || []).map(p => ({
    timestamp: p.timestamp,
    price: p.price,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
  }));

  // Calculate stats
  const priceValues = prices.map(p => p.price).filter(Boolean);
  const high = priceValues.length > 0 ? Math.max(...priceValues) : null;
  const low = priceValues.length > 0 ? Math.min(...priceValues) : null;
  const first = priceValues[0] || null;
  const last = priceValues[priceValues.length - 1] || null;
  const change = first && last ? ((last - first) / first) * 100 : null;

  const historyData = {
    symbol: symbolOrAddress.toUpperCase(),
    address,
    timeframe,
    granularity,
    dataPoints: prices.length,
    prices,
    stats: { high, low, open: first, close: last, changePercent: change },
    source: 'allium',
  };

  setCache(cacheKey, historyData);
  return historyData;
}

/**
 * Get wallet PnL (profit and loss) from Allium.
 * @param {string} walletAddress - Solana wallet address
 * @returns {Object|null} PnL data or null on failure
 */
async function getWalletPnL(walletAddress) {
  if (!walletAddress || walletAddress.length < 32) return null;

  const cacheKey = `allium_pnl_${walletAddress}`;
  const cached = getCached(cacheKey, 60000); // 1min cache
  if (cached) return cached;

  const body = [{ chain: 'solana', address: walletAddress }];
  const result = await alliumFetch('/wallet/pnl', body);
  if (!result?.items?.[0]) return null;

  const item = result.items[0];

  // Check for error response
  if (item.message) {
    console.warn(`[Allium] PnL error for ${walletAddress.slice(0, 8)}: ${item.message}`);
    return null;
  }

  const tokens = (item.tokens || []).map(t => ({
    tokenAddress: t.token_address,
    averageCost: parseFloat(t.average_cost) || 0,
    currentPrice: parseFloat(t.current_price) || 0,
    currentBalance: parseFloat(t.current_balance?.amount) || parseFloat(t.current_balance) || 0,
    rawBalance: t.raw_balance,
    realizedPnl: parseFloat(t.realized_pnl?.amount) || 0,
    unrealizedPnl: parseFloat(t.unrealized_pnl?.amount) || 0,
    unrealizedPnlPercent: t.unrealized_pnl_ratio_change || null,
  }));

  const pnlData = {
    wallet: walletAddress,
    totalBalance: parseFloat(item.total_balance?.amount) || 0,
    totalRealizedPnl: parseFloat(item.total_realized_pnl?.amount) || 0,
    totalUnrealizedPnl: parseFloat(item.total_unrealized_pnl?.amount) || 0,
    totalUnrealizedPnlPercent: item.total_unrealized_pnl_ratio_change || null,
    tokens: tokens.filter(t => t.currentBalance > 0 || Math.abs(t.realizedPnl) > 0.01),
    source: 'allium',
  };

  setCache(cacheKey, pnlData);
  return pnlData;
}

/**
 * Get enriched transaction history for a wallet.
 * @param {string} walletAddress - Solana wallet address
 * @param {number} limit - Max transactions to return (default 10)
 * @returns {Object|null} Transaction data or null on failure
 */
async function getWalletTransactions(walletAddress, limit = 10) {
  if (!walletAddress || walletAddress.length < 32) return null;

  const cacheKey = `allium_txs_${walletAddress}_${limit}`;
  const cached = getCached(cacheKey, 30000); // 30s cache
  if (cached) return cached;

  const body = [{ chain: 'solana', address: walletAddress }];
  const result = await alliumFetch('/wallet/transactions', body, { limit });
  if (!result?.items) return null;

  const transactions = result.items.map(tx => ({
    hash: tx.hash,
    timestamp: tx.block_timestamp,
    blockNumber: tx.block_number,
    labels: tx.labels || [],
    from: tx.from_address,
    to: tx.to_address,
    fee: tx.fee?.amount || null,
    transfers: (tx.asset_transfers || []).map(t => ({
      type: t.transfer_type,
      from: t.from_address,
      to: t.to_address,
      asset: t.asset?.symbol || t.asset?.address?.slice(0, 8) || 'unknown',
      assetType: t.asset?.type,
      amount: t.amount?.amount_str || t.amount?.raw_amount || '0',
    })),
    activities: (tx.activities || []).map(a => ({
      type: a.type,
    })),
  }));

  const txData = {
    wallet: walletAddress,
    transactions,
    total: transactions.length,
    source: 'allium',
  };

  setCache(cacheKey, txData);
  return txData;
}

/**
 * Get price at a specific historical timestamp.
 * @param {string} symbolOrAddress - Token symbol or mint address
 * @param {string} timestamp - ISO 8601 timestamp (e.g. "2025-01-15T00:00:00Z")
 * @returns {Object|null} Price data or null
 */
async function getPriceAtTime(symbolOrAddress, timestamp) {
  const address = resolveTokenAddress(symbolOrAddress);
  if (!address || !timestamp) return null;

  const cacheKey = `allium_price_at_${address}_${timestamp}`;
  const cached = getCached(cacheKey, 300000); // 5min cache (historical data doesn't change)
  if (cached) return cached;

  // Fetch a 1-hour window around the timestamp
  const targetTime = new Date(timestamp);
  if (isNaN(targetTime.getTime())) return null;

  const start = new Date(targetTime.getTime() - 30 * 60 * 1000); // 30min before
  const end = new Date(targetTime.getTime() + 30 * 60 * 1000);   // 30min after

  const body = {
    start_timestamp: start.toISOString(),
    end_timestamp: end.toISOString(),
    addresses: [{ chain: 'solana', token_address: address }],
    time_granularity: '5m',
  };

  const result = await alliumFetch('/prices/history', body);
  if (!result?.items?.[0]?.prices?.length) return null;

  // Find the closest price to the target timestamp
  const prices = result.items[0].prices;
  let closest = prices[0];
  let minDiff = Infinity;
  for (const p of prices) {
    const diff = Math.abs(new Date(p.timestamp).getTime() - targetTime.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closest = p;
    }
  }

  const priceAtData = {
    symbol: symbolOrAddress.toUpperCase(),
    address,
    requestedTimestamp: timestamp,
    actualTimestamp: closest.timestamp,
    price: closest.price,
    open: closest.open,
    high: closest.high,
    low: closest.low,
    close: closest.close,
    source: 'allium',
  };

  setCache(cacheKey, priceAtData);
  return priceAtData;
}

/**
 * Check if Allium is available (API key configured).
 */
function isAvailable() {
  return !!API_KEY;
}

module.exports = {
  getLatestPrices,
  getPriceHistory,
  getWalletPnL,
  getWalletTransactions,
  getPriceAtTime,
  isAvailable,
  resolveTokenAddress,
};
