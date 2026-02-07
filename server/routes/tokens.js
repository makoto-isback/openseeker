const express = require('express');
const router = express.Router();
const { getCached, setCache } = require('../utils/cache');
const { MINT_MAP } = require('../services/jupiter');

const DEXSCREENER_BOOSTS = 'https://api.dexscreener.com/token-boosts/top/v1';
const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens';
const DEXSCREENER_SEARCH = 'https://api.dexscreener.com/latest/dex/search';

function computeSafetyScore(token) {
  let score = 5; // Start at 5/10
  const flags = [];

  // Liquidity
  if (token.liquidity > 1000000) score += 2;
  else if (token.liquidity > 100000) score += 1;
  else { score -= 2; flags.push('LOW_LIQUIDITY'); }

  // Volume
  if (token.volume24h > 1000000) score += 1;

  // Age (parsed from pairCreatedAt)
  if (token.pairAge) {
    const ageMs = Date.now() - token.pairCreatedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 7) { score -= 2; flags.push('NEW_TOKEN'); }
    else if (ageDays > 30) score += 1;
  }

  // Buy/sell ratio
  if (token.txns24h) {
    const ratio = token.txns24h.buys / Math.max(token.txns24h.sells, 1);
    if (ratio < 0.5) { score -= 1; flags.push('HIGH_SELL_PRESSURE'); }
  }

  // Clamp to 1-10
  score = Math.max(1, Math.min(10, score));

  return { safetyScore: score, flags };
}

function parsePairData(pair) {
  const base = pair.baseToken || {};
  const liq = pair.liquidity || {};
  const vol = pair.volume || {};
  const txns = pair.txns || {};
  const priceChange = pair.priceChange || {};

  return {
    name: base.name || 'Unknown',
    symbol: base.symbol || '???',
    address: base.address || '',
    price: parseFloat(pair.priceUsd) || 0,
    priceChange5m: priceChange.m5 || 0,
    priceChange1h: priceChange.h1 || 0,
    priceChange6h: priceChange.h6 || 0,
    priceChange24h: priceChange.h24 || 0,
    volume24h: vol.h24 || 0,
    liquidity: liq.usd || 0,
    marketCap: pair.marketCap || pair.fdv || 0,
    fdv: pair.fdv || 0,
    txns24h: { buys: txns.h24?.buys || 0, sells: txns.h24?.sells || 0 },
    txns1h: { buys: txns.h1?.buys || 0, sells: txns.h1?.sells || 0 },
    pairAddress: pair.pairAddress || '',
    dex: pair.dexId || '',
    pairCreatedAt: pair.pairCreatedAt || 0,
    pairAge: pair.pairCreatedAt ? formatAge(pair.pairCreatedAt) : 'unknown',
    url: pair.url || '',
    dexscreenerUrl: pair.url || `https://dexscreener.com/solana/${pair.pairAddress || ''}`,
    website: pair.info?.websites?.[0]?.url || null,
    twitter: pair.info?.socials?.find(s => s.type === 'twitter')?.url || null,
  };
}

function formatAge(createdAt) {
  const ms = Date.now() - createdAt;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
}

// GET /api/tokens/trending?limit=10
router.get('/trending', async (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const cacheKey = 'trending_tokens';
    const cached = getCached(cacheKey, 60000); // 1 min cache
    if (cached) return res.json(cached);

    const boostRes = await fetch(DEXSCREENER_BOOSTS, { signal: AbortSignal.timeout(10000) });
    if (!boostRes.ok) throw new Error(`DexScreener boosts error: ${boostRes.status}`);

    const boosts = await boostRes.json();
    // Filter for Solana tokens
    const solanaTokens = (boosts || []).filter(t => t.chainId === 'solana').slice(0, 20);

    // Fetch pair data for each token (batch up to 20 addresses)
    const addresses = solanaTokens.map(t => t.tokenAddress).filter(Boolean);
    let pairData = {};

    if (addresses.length > 0) {
      // DexScreener allows comma-separated addresses (up to 30)
      try {
        const pairRes = await fetch(`${DEXSCREENER_TOKENS}/${addresses.join(',')}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (pairRes.ok) {
          const pairJson = await pairRes.json();
          // Group pairs by base token address, pick highest liquidity pair
          for (const pair of (pairJson.pairs || [])) {
            if (pair.chainId !== 'solana') continue;
            const addr = pair.baseToken?.address;
            if (!addr) continue;
            if (!pairData[addr] || (pair.liquidity?.usd || 0) > (pairData[addr].liquidity?.usd || 0)) {
              pairData[addr] = pair;
            }
          }
        }
      } catch (err) {
        console.warn('[Tokens] Pair data fetch error:', err.message);
      }
    }

    const tokens = [];
    for (const boost of solanaTokens) {
      const pair = pairData[boost.tokenAddress];
      if (!pair) continue;
      const parsed = parsePairData(pair);
      if (parsed.liquidity < 10000) continue; // Skip ultra-low liquidity
      const { safetyScore, flags } = computeSafetyScore(parsed);
      tokens.push({ ...parsed, safetyScore, flags, boostAmount: boost.totalAmount || 0 });
    }

    // Sort by volume
    tokens.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    const result = { tokens: tokens.slice(0, parseInt(limit) || 10) };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[Tokens] Trending error:', err.message);
    res.status(500).json({ error: 'Failed to fetch trending tokens' });
  }
});

// GET /api/tokens/research/:addressOrSymbol
router.get('/research/:addressOrSymbol', async (req, res) => {
  try {
    const { addressOrSymbol } = req.params;
    const cacheKey = `research_${addressOrSymbol.toLowerCase()}`;
    const cached = getCached(cacheKey, 30000); // 30s cache
    if (cached) return res.json(cached);

    let address = addressOrSymbol;

    // If it looks like a symbol (short, no numbers), resolve to address
    if (addressOrSymbol.length < 20) {
      const sym = addressOrSymbol.toUpperCase();
      // Check our known mints first
      if (MINT_MAP[sym]) {
        address = MINT_MAP[sym];
      } else {
        // Search DexScreener
        const searchRes = await fetch(`${DEXSCREENER_SEARCH}?q=${encodeURIComponent(addressOrSymbol)}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          const solanaPair = (searchJson.pairs || []).find(p =>
            p.chainId === 'solana' &&
            p.baseToken?.symbol?.toUpperCase() === sym
          );
          if (solanaPair) {
            address = solanaPair.baseToken.address;
          }
        }
      }
    }

    // Fetch token pair data
    const pairRes = await fetch(`${DEXSCREENER_TOKENS}/${address}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!pairRes.ok) throw new Error(`DexScreener token error: ${pairRes.status}`);

    const pairJson = await pairRes.json();
    const solanaPairs = (pairJson.pairs || []).filter(p => p.chainId === 'solana');

    if (solanaPairs.length === 0) {
      return res.status(404).json({ error: `Token not found: ${addressOrSymbol}` });
    }

    // Pick the most liquid pair
    solanaPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const bestPair = solanaPairs[0];
    const parsed = parsePairData(bestPair);
    const { safetyScore, flags } = computeSafetyScore(parsed);

    const result = { token: { ...parsed, safetyScore, flags } };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[Tokens] Research error:', err.message);
    res.status(500).json({ error: 'Failed to research token' });
  }
});

// GET /api/tokens/new?limit=10&minLiquidity=10000
router.get('/new', async (req, res) => {
  try {
    const { limit = '10', minLiquidity = '10000' } = req.query;
    const cacheKey = 'new_tokens';
    const cached = getCached(cacheKey, 60000); // 1 min cache
    if (cached) return res.json(cached);

    // Use DexScreener latest profiles/pairs
    const latestRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
      signal: AbortSignal.timeout(10000),
    });
    if (!latestRes.ok) throw new Error(`DexScreener latest error: ${latestRes.status}`);

    const profiles = await latestRes.json();
    // Filter for Solana tokens
    const solanaTokens = (profiles || []).filter(t => t.chainId === 'solana').slice(0, 30);
    const addresses = solanaTokens.map(t => t.tokenAddress).filter(Boolean);

    let pairData = {};
    if (addresses.length > 0) {
      try {
        // Batch fetch in groups of 30
        const batch = addresses.slice(0, 30);
        const pairRes = await fetch(`${DEXSCREENER_TOKENS}/${batch.join(',')}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (pairRes.ok) {
          const pairJson = await pairRes.json();
          for (const pair of (pairJson.pairs || [])) {
            if (pair.chainId !== 'solana') continue;
            const addr = pair.baseToken?.address;
            if (!addr) continue;
            if (!pairData[addr] || (pair.liquidity?.usd || 0) > (pairData[addr].liquidity?.usd || 0)) {
              pairData[addr] = pair;
            }
          }
        }
      } catch (err) {
        console.warn('[Tokens] New tokens pair data fetch error:', err.message);
      }
    }

    const tokens = [];
    const minLiq = parseInt(minLiquidity) || 10000;
    for (const profile of solanaTokens) {
      const pair = pairData[profile.tokenAddress];
      if (!pair) continue;
      const parsed = parsePairData(pair);
      if (parsed.liquidity < minLiq) continue;
      const { safetyScore, flags } = computeSafetyScore(parsed);

      // Calculate age
      let ageHours = null;
      if (pair.pairCreatedAt) {
        ageHours = Math.round((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60));
      }

      tokens.push({
        ...parsed,
        safetyScore,
        flags,
        ageHours,
        description: profile.description || null,
        icon: profile.icon || null,
      });
    }

    // Sort by newest first (lowest age)
    tokens.sort((a, b) => (a.ageHours || 9999) - (b.ageHours || 9999));
    const result = { tokens: tokens.slice(0, parseInt(limit) || 10) };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[Tokens] New tokens error:', err.message);
    res.status(500).json({ error: 'Failed to fetch new tokens' });
  }
});

module.exports = router;
