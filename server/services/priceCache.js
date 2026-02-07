/**
 * Server-side price cache — Jupiter primary, CoinGecko fallback.
 * All users share one cache — eliminates rate limiting.
 */

const JUPITER_API_KEY = process.env.JUPITER_API_KEY || 'ce8c789c-1bcd-4437-87e9-529fc7605963';
const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v3/price';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

// Token mint addresses for Jupiter
const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  JITOSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  BSOL: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  INF: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm',
  POPCAT: '7GCihgDB8fe6LNa32gd7QZHCpbU2MBog6LHNb2LBHEZH',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  HNT: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
  RNDR: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
};

// CoinGecko IDs for market data fallback
const COINGECKO_IDS = {
  SOL: 'solana',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  WIF: 'dogwifcoin',
  BONK: 'bonk',
  JUP: 'jupiter-exchange-solana',
  JITOSOL: 'jito-staked-sol',
  MSOL: 'marinade-staked-sol',
  RAY: 'raydium',
  POPCAT: 'popcat',
  PYTH: 'pyth-network',
  ORCA: 'orca',
  HNT: 'helium',
  RNDR: 'render-token',
  USDC: 'usd-coin',
  USDT: 'tether',
};

// Reverse maps
const MINT_TO_SYMBOL = {};
for (const [sym, mint] of Object.entries(TOKEN_MINTS)) {
  MINT_TO_SYMBOL[mint] = sym;
}
const CGID_TO_SYMBOL = {};
for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
  CGID_TO_SYMBOL[id] = sym;
}

// In-memory cache
const priceCache = {};   // { SOL: { price, timestamp, source } }
const marketCache = {};  // { SOL: { change_24h, market_cap, volume_24h, timestamp } }

const PRICE_TTL = 30 * 1000;          // 30 seconds
const MARKET_TTL = 5 * 60 * 1000;     // 5 minutes
const STALE_TTL = 15 * 60 * 1000;     // 15 min stale data still returned

// ============================================================
// Jupiter Price Fetch (PRIMARY)
// ============================================================

async function fetchJupiterPrices(symbols) {
  const mints = [];
  const mintSymMap = {};
  for (const sym of symbols) {
    const s = sym.toUpperCase();
    const mint = TOKEN_MINTS[s];
    if (mint) {
      mints.push(mint);
      mintSymMap[mint] = s;
    }
  }
  if (mints.length === 0) return;

  const url = `${JUPITER_PRICE_URL}?ids=${mints.join(',')}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': JUPITER_API_KEY },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Jupiter API ${res.status}`);

  const data = await res.json();

  for (const [mint, info] of Object.entries(data)) {
    const sym = mintSymMap[mint] || MINT_TO_SYMBOL[mint];
    if (sym && info.usdPrice) {
      priceCache[sym] = {
        price: parseFloat(info.usdPrice),
        timestamp: Date.now(),
        source: 'jupiter',
      };
      // V3 also returns 24h change — cache it
      if (info.priceChange24h !== undefined) {
        if (!marketCache[sym]) marketCache[sym] = { timestamp: 0 };
        marketCache[sym].change_24h = info.priceChange24h;
        marketCache[sym].timestamp = Date.now();
      }
    }
  }
}

// ============================================================
// CoinGecko Market Data (FALLBACK)
// ============================================================

async function fetchCoinGeckoData(symbols) {
  const ids = [];
  const idSymMap = {};
  for (const sym of symbols) {
    const s = sym.toUpperCase();
    const id = COINGECKO_IDS[s];
    if (id) {
      ids.push(id);
      idSymMap[id] = s;
    }
  }
  if (ids.length === 0) return;

  const url = `${COINGECKO_URL}?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

  if (res.status === 429) {
    console.log('[PriceCache] CoinGecko rate limited — using cached data');
    return;
  }
  if (!res.ok) throw new Error(`CoinGecko API ${res.status}`);

  const data = await res.json();

  for (const [id, info] of Object.entries(data)) {
    const sym = idSymMap[id] || CGID_TO_SYMBOL[id];
    if (!sym) continue;

    marketCache[sym] = {
      change_24h: info.usd_24h_change || 0,
      market_cap: info.usd_market_cap || 0,
      volume_24h: info.usd_24h_vol || 0,
      timestamp: Date.now(),
    };

    // Also update price if we don't have a fresh Jupiter price
    if (info.usd && (!priceCache[sym] || (Date.now() - priceCache[sym].timestamp) >= PRICE_TTL)) {
      priceCache[sym] = {
        price: info.usd,
        timestamp: Date.now(),
        source: 'coingecko',
      };
    }
  }
}

// ============================================================
// Main: Get Price
// ============================================================

async function getPrice(symbol) {
  const sym = symbol.toUpperCase().trim();

  // Check cache first
  const cached = priceCache[sym];
  if (cached && (Date.now() - cached.timestamp) < PRICE_TTL) {
    const market = marketCache[sym] || {};
    return {
      symbol: sym,
      price: cached.price,
      change_24h: market.change_24h || null,
      market_cap: market.market_cap || null,
      volume_24h: market.volume_24h || null,
      source: cached.source,
      cached: true,
    };
  }

  // Try Jupiter first
  try {
    await fetchJupiterPrices([sym]);
    // Fire-and-forget CoinGecko for market data
    fetchCoinGeckoData([sym]).catch(() => {});
  } catch (err) {
    console.log(`[PriceCache] Jupiter failed for ${sym}: ${err.message}`);
  }

  // If Jupiter didn't give us a fresh price, try CoinGecko
  if (!priceCache[sym] || (Date.now() - priceCache[sym].timestamp) >= PRICE_TTL) {
    try {
      await fetchCoinGeckoData([sym]);
    } catch (err) {
      console.log(`[PriceCache] CoinGecko also failed for ${sym}: ${err.message}`);
    }
  }

  // Return whatever we have (even stale data)
  const price = priceCache[sym];
  const market = marketCache[sym] || {};

  if (price && (Date.now() - price.timestamp) < STALE_TTL) {
    return {
      symbol: sym,
      price: price.price,
      change_24h: market.change_24h || null,
      market_cap: market.market_cap || null,
      volume_24h: market.volume_24h || null,
      source: price.source,
      cached: (Date.now() - price.timestamp) > PRICE_TTL,
    };
  }

  return null;
}

// ============================================================
// Batch: Get Multiple Prices
// ============================================================

async function getPrices(symbols) {
  const syms = symbols.map(s => s.toUpperCase().trim());
  const needRefresh = syms.filter(s => {
    const c = priceCache[s];
    return !c || (Date.now() - c.timestamp) >= PRICE_TTL;
  });

  if (needRefresh.length > 0) {
    try {
      await fetchJupiterPrices(needRefresh);
    } catch (err) {
      console.log(`[PriceCache] Jupiter batch failed: ${err.message}`);
    }

    // Check what's still missing after Jupiter
    const stillMissing = needRefresh.filter(s => {
      const c = priceCache[s];
      return !c || (Date.now() - c.timestamp) >= PRICE_TTL;
    });

    if (stillMissing.length > 0) {
      try {
        await fetchCoinGeckoData(stillMissing);
      } catch (err) {
        console.log(`[PriceCache] CoinGecko batch fallback failed: ${err.message}`);
      }
    }

    // Background market data
    fetchCoinGeckoData(needRefresh).catch(() => {});
  }

  const results = {};
  for (const s of syms) {
    const p = priceCache[s];
    const m = marketCache[s] || {};
    results[s] = p ? {
      symbol: s,
      price: p.price,
      change_24h: m.change_24h || null,
      market_cap: m.market_cap || null,
      volume_24h: m.volume_24h || null,
      source: p.source,
    } : null;
  }
  return results;
}

// ============================================================
// Market Data (detailed)
// ============================================================

async function getMarketData(symbol) {
  const sym = symbol.toUpperCase().trim();

  // Always get price first
  const priceData = await getPrice(sym);

  // Check market cache
  const market = marketCache[sym];
  if (market && (Date.now() - market.timestamp) < MARKET_TTL) {
    return {
      symbol: sym,
      price: priceData?.price || 0,
      change_24h: market.change_24h || 0,
      volume_24h: market.volume_24h || 0,
      market_cap: market.market_cap || 0,
      source: priceData?.source || 'cache',
    };
  }

  // Fetch market data from CoinGecko
  try {
    await fetchCoinGeckoData([sym]);
  } catch (err) {
    console.log(`[PriceCache] CoinGecko market data failed for ${sym}: ${err.message}`);
  }

  const m = marketCache[sym] || {};
  return {
    symbol: sym,
    price: priceData?.price || 0,
    change_24h: m.change_24h || 0,
    volume_24h: m.volume_24h || 0,
    market_cap: m.market_cap || 0,
    source: priceData?.source || 'cache',
  };
}

// ============================================================
// Helpers
// ============================================================

function getMintAddress(symbol) {
  return TOKEN_MINTS[symbol.toUpperCase()] || null;
}

function getSymbolFromMint(mint) {
  return MINT_TO_SYMBOL[mint] || null;
}

function addToken(symbol, mint, coingeckoId) {
  const s = symbol.toUpperCase();
  TOKEN_MINTS[s] = mint;
  MINT_TO_SYMBOL[mint] = s;
  if (coingeckoId) {
    COINGECKO_IDS[s] = coingeckoId;
    CGID_TO_SYMBOL[coingeckoId] = s;
  }
}

// ============================================================
// Background: Warm cache for popular tokens
// ============================================================

async function warmCache() {
  const popular = ['SOL', 'USDC', 'WIF', 'BONK', 'JUP', 'JITOSOL', 'RAY'];
  try {
    await fetchJupiterPrices(popular);
    await fetchCoinGeckoData(popular);
    console.log(`[PriceCache] Warmed ${popular.length} tokens`);
  } catch (err) {
    console.log(`[PriceCache] Warm failed: ${err.message}`);
  }
}

setInterval(warmCache, 60 * 1000);
setTimeout(warmCache, 2000);

module.exports = {
  getPrice,
  getPrices,
  getMarketData,
  getMintAddress,
  getSymbolFromMint,
  addToken,
  warmCache,
  TOKEN_MINTS,
  COINGECKO_IDS,
};
