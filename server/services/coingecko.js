const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Symbol → CoinGecko ID mapping
const SYMBOL_MAP = {
  SOL: 'solana',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  WIF: 'dogwifcoin',
  JUP: 'jupiter-exchange-solana',
  BONK: 'bonk',
  PYTH: 'pyth-network',
  RAY: 'raydium',
  ORCA: 'orca',
  MSOL: 'marinade-staked-sol',
  JITO: 'jito-governance-token',
  HNT: 'helium',
  RNDR: 'render-token',
  USDC: 'usd-coin',
  USDT: 'tether',
};

// In-memory cache with 60s TTL (extended to 5min on 429)
const cache = new Map();
let CACHE_TTL = 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function symbolToId(symbol) {
  return SYMBOL_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
}

/**
 * Get price for a single token.
 */
async function getPrice(symbol) {
  const id = symbolToId(symbol);
  const cacheKey = `price:${id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `${COINGECKO_BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url);
  if (res.status === 429) {
    CACHE_TTL = 5 * 60 * 1000;
    console.log('[CoinGecko] Rate limited, extending cache to 5min');
    throw new Error('CoinGecko rate limited — try again later');
  }
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = await res.json();
  const tokenData = data[id];
  if (!tokenData) throw new Error(`No data for ${symbol}`);

  const result = {
    symbol: symbol.toUpperCase(),
    price: tokenData.usd,
    change_24h: tokenData.usd_24h_change || 0,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get prices for multiple tokens in a single request.
 */
async function getPrices(symbols) {
  // Check which symbols we already have cached
  const results = {};
  const uncachedIds = [];
  const uncachedSymbols = [];

  for (const symbol of symbols) {
    const id = symbolToId(symbol);
    const cached = getCached(`price:${id}`);
    if (cached) {
      results[symbol.toUpperCase()] = cached;
    } else {
      uncachedIds.push(id);
      uncachedSymbols.push(symbol.toUpperCase());
    }
  }

  if (uncachedIds.length === 0) return results;

  const ids = uncachedIds.join(',');
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url);
  if (res.status === 429) {
    CACHE_TTL = 5 * 60 * 1000;
    console.log('[CoinGecko] Rate limited, extending cache to 5min');
    throw new Error('CoinGecko rate limited — try again later');
  }
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = await res.json();

  for (let i = 0; i < uncachedIds.length; i++) {
    const id = uncachedIds[i];
    const symbol = uncachedSymbols[i];
    const tokenData = data[id];
    if (tokenData) {
      const result = {
        symbol,
        price: tokenData.usd,
        change_24h: tokenData.usd_24h_change || 0,
      };
      setCache(`price:${id}`, result);
      results[symbol] = result;
    }
  }

  return results;
}

/**
 * Get detailed market data for a single token.
 */
async function getMarketData(symbol) {
  const id = symbolToId(symbol);
  const cacheKey = `market:${id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `${COINGECKO_BASE}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
  const res = await fetch(url);
  if (res.status === 429) {
    CACHE_TTL = 5 * 60 * 1000;
    console.log('[CoinGecko] Rate limited, extending cache to 5min');
    throw new Error('CoinGecko rate limited — try again later');
  }
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = await res.json();
  const tokenData = data[id];
  if (!tokenData) throw new Error(`No data for ${symbol}`);

  const result = {
    symbol: symbol.toUpperCase(),
    price: tokenData.usd,
    change_24h: tokenData.usd_24h_change || 0,
    volume_24h: tokenData.usd_24h_vol || 0,
    market_cap: tokenData.usd_market_cap || 0,
  };

  setCache(cacheKey, result);
  return result;
}

module.exports = { getPrice, getPrices, getMarketData, SYMBOL_MAP };
