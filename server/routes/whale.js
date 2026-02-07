const express = require('express');
const router = express.Router();
const { getCached, setCache } = require('../utils/cache');
const { x402 } = require('../middleware/x402');

// In-memory watched wallets (persisted per-session, could use SQLite later)
const watchedWallets = new Map(); // wallet -> { label, addedAt, lastChecked }

const HELIUS_API = 'https://api.helius.xyz/v0';
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

/**
 * POST /api/whale/watch — Add a wallet to watch list
 * Body: { wallet, label? }
 */
router.post('/watch', x402(0.002), async (req, res) => {
  try {
    const { wallet, label } = req.body;
    if (!wallet || wallet.length < 32) {
      return res.status(400).json({ error: 'Valid Solana wallet address required' });
    }

    watchedWallets.set(wallet, {
      label: label || `Whale ${wallet.slice(0, 6)}`,
      addedAt: Date.now(),
      lastChecked: 0,
    });

    res.json({
      success: true,
      wallet,
      label: label || `Whale ${wallet.slice(0, 6)}`,
      total_watched: watchedWallets.size,
    });
  } catch (err) {
    console.error('[Whale] Watch error:', err.message);
    res.status(500).json({ error: 'Failed to add whale watch' });
  }
});

/**
 * GET /api/whale/watched — Get all watched wallets
 */
router.get('/watched', async (req, res) => {
  const wallets = [];
  for (const [address, info] of watchedWallets.entries()) {
    wallets.push({ address, ...info });
  }
  res.json({ wallets, total: wallets.length });
});

/**
 * DELETE /api/whale/watch/:wallet — Remove a watched wallet
 */
router.delete('/watch/:wallet', async (req, res) => {
  const { wallet } = req.params;
  const existed = watchedWallets.delete(wallet);
  res.json({ success: true, removed: existed, total_watched: watchedWallets.size });
});

/**
 * GET /api/whale/activity/:wallet — Get recent activity for a whale wallet
 */
router.get('/activity/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const cacheKey = `whale_activity_${wallet}`;
    const cached = getCached(cacheKey, 60000);
    if (cached) return res.json(cached);

    let transactions = [];
    let source = 'mock';

    // Try Helius API if key is available
    if (HELIUS_KEY) {
      try {
        const url = `${HELIUS_API}/addresses/${wallet}/transactions?api-key=${HELIUS_KEY}&limit=10&type=SWAP`;
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (response.ok) {
          const data = await response.json();
          transactions = (data || []).map(tx => ({
            signature: tx.signature,
            type: tx.type || 'UNKNOWN',
            description: tx.description || '',
            timestamp: tx.timestamp ? tx.timestamp * 1000 : Date.now(),
            fee: tx.fee || 0,
            nativeTransfers: (tx.nativeTransfers || []).map(t => ({
              from: t.fromUserAccount,
              to: t.toUserAccount,
              amount: (t.amount || 0) / 1e9,
            })),
            tokenTransfers: (tx.tokenTransfers || []).map(t => ({
              from: t.fromUserAccount,
              to: t.toUserAccount,
              mint: t.mint,
              amount: t.tokenAmount || 0,
              symbol: t.tokenStandard || '',
            })),
          }));
          source = 'helius';
        }
      } catch (err) {
        console.warn('[Whale] Helius API error:', err.message);
      }
    }

    // Mock fallback
    if (transactions.length === 0) {
      const now = Date.now();
      transactions = [
        {
          signature: 'mock_' + Math.random().toString(36).slice(2, 10),
          type: 'SWAP',
          description: `Swapped 500 SOL for 250,000 USDC`,
          timestamp: now - 3600000,
          fee: 0.000005,
          nativeTransfers: [{ from: wallet, to: 'JUP...', amount: 500 }],
          tokenTransfers: [{ from: 'JUP...', to: wallet, mint: 'EPjFWdd5...', amount: 250000, symbol: 'USDC' }],
        },
        {
          signature: 'mock_' + Math.random().toString(36).slice(2, 10),
          type: 'SWAP',
          description: `Bought 10,000 WIF with 50 SOL`,
          timestamp: now - 7200000,
          fee: 0.000005,
          nativeTransfers: [{ from: wallet, to: 'JUP...', amount: 50 }],
          tokenTransfers: [{ from: 'JUP...', to: wallet, mint: 'EKpQGS...', amount: 10000, symbol: 'WIF' }],
        },
        {
          signature: 'mock_' + Math.random().toString(36).slice(2, 10),
          type: 'TRANSFER',
          description: `Received 1,000 SOL from exchange`,
          timestamp: now - 14400000,
          fee: 0.000005,
          nativeTransfers: [{ from: 'Exchange...', to: wallet, amount: 1000 }],
          tokenTransfers: [],
        },
      ];
      source = 'mock';
    }

    const result = {
      wallet,
      label: watchedWallets.get(wallet)?.label || `Whale ${wallet.slice(0, 6)}`,
      transactions,
      source,
      fetched_at: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[Whale] Activity error:', err.message);
    res.status(500).json({ error: 'Failed to fetch whale activity' });
  }
});

/**
 * GET /api/whale/feed — Aggregated feed of all watched wallets' recent activity
 */
router.get('/feed', async (req, res) => {
  try {
    const cacheKey = 'whale_feed';
    const cached = getCached(cacheKey, 30000);
    if (cached) return res.json(cached);

    const feed = [];
    for (const [wallet, info] of watchedWallets.entries()) {
      // Generate mock activity for each watched wallet
      const now = Date.now();
      feed.push({
        wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
        label: info.label,
        action: 'SWAP',
        description: `Bought SOL worth $${(Math.random() * 50000 + 10000).toFixed(0)}`,
        timestamp: now - Math.floor(Math.random() * 86400000),
        source: 'mock',
      });
    }

    feed.sort((a, b) => b.timestamp - a.timestamp);

    const result = { feed: feed.slice(0, 20), total_watched: watchedWallets.size, source: 'mock' };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[Whale] Feed error:', err.message);
    res.status(500).json({ error: 'Failed to fetch whale feed' });
  }
});

module.exports = router;
