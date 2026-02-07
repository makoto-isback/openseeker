const express = require('express');
const router = express.Router();
const { getCached, setCache } = require('../utils/cache');

const DEFILLAMA_POOLS_URL = 'https://yields.llama.fi/pools';
const CACHE_KEY = 'defillama_pools';
const CACHE_MS = 5 * 60 * 1000; // 5 minutes

// Known liquid staking tokens
const LIQUID_STAKING_SYMBOLS = ['msol', 'jitosol', 'bsol', 'inf', 'hsol', 'lst', 'jsol', 'scnsol'];
const LENDING_PROJECTS = ['solend', 'marginfi', 'kamino', 'drift', 'save'];
const STABLE_TOKENS = ['usdc', 'usdt', 'dai', 'usdh', 'usdy'];

function categorizePool(pool) {
  const sym = (pool.symbol || '').toLowerCase();
  const project = (pool.project || '').toLowerCase();

  // Liquid staking — single token, easy
  if (pool.exposure === 'single' && LIQUID_STAKING_SYMBOLS.some(s => sym.includes(s))) {
    return { category: 'liquid_staking', difficulty: 'easy', action: 'swap' };
  }

  // Lending
  if (LENDING_PROJECTS.some(p => project.includes(p)) && pool.exposure === 'single') {
    return { category: 'lending', difficulty: 'advanced', action: 'external' };
  }

  // LP — stable pairs
  if (pool.exposure === 'multi') {
    const tokens = sym.split('-');
    const allStable = tokens.every(t => STABLE_TOKENS.some(s => t.includes(s)));
    if (allStable) {
      return { category: 'lp_stable', difficulty: 'medium', action: 'external' };
    }
    return { category: 'lp_volatile', difficulty: 'medium', action: 'external' };
  }

  // Single token staking/lending
  if (pool.exposure === 'single') {
    return { category: 'staking', difficulty: 'easy', action: 'external' };
  }

  return { category: 'other', difficulty: 'medium', action: 'external' };
}

async function fetchPools() {
  const cached = getCached(CACHE_KEY, CACHE_MS);
  if (cached) return cached;

  const res = await fetch(DEFILLAMA_POOLS_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`DeFiLlama API error: ${res.status}`);

  const json = await res.json();
  const pools = (json.data || []).filter(p =>
    p.chain === 'Solana' && p.tvlUsd > 100000 && p.apy != null
  );

  setCache(CACHE_KEY, pools);
  return pools;
}

// GET /api/defi/yields?sort=apy&limit=10&token=SOL
router.get('/yields', async (req, res) => {
  try {
    const { sort = 'apy', limit = '10', token } = req.query;
    let pools = await fetchPools();

    // Filter by token if specified
    if (token) {
      const t = token.toLowerCase();
      pools = pools.filter(p => (p.symbol || '').toLowerCase().includes(t));
    }

    // Sort
    if (sort === 'tvl') {
      pools.sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0));
    } else {
      pools.sort((a, b) => (b.apy || 0) - (a.apy || 0));
    }

    // Limit
    pools = pools.slice(0, parseInt(limit) || 10);

    // Enrich
    const result = pools.map(p => {
      const cat = categorizePool(p);
      return {
        pool: p.pool,
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        rewardTokens: p.rewardTokens || [],
        exposure: p.exposure,
        poolMeta: p.poolMeta || null,
        il7d: p.il7d || null,
        ...cat,
      };
    });

    res.json({ pools: result });
  } catch (err) {
    console.error('[DeFi] Yields error:', err.message);
    res.status(500).json({ error: 'Failed to fetch DeFi yields' });
  }
});

module.exports = router;
module.exports.fetchPools = fetchPools;
module.exports.categorizePool = categorizePool;
