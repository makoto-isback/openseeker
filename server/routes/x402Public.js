/**
 * Public x402 API Endpoints
 *
 * These endpoints are gated behind x402 USDC payments.
 * Other AI agents and services can pay to use OpenSeeker's data.
 * This is how OpenSeeker becomes a data provider in the x402 ecosystem.
 */
const express = require('express');
const router = express.Router();
const { x402Gate } = require('../middleware/x402Middleware');
const { executeSkill } = require('../services/skills');
const { PRICING, TREASURY_WALLET, USDC_ADDRESS, NETWORK } = require('../services/x402Handler');

// GET /api/x402/trending — Live trending tokens from DexScreener
router.get('/trending', x402Gate('trending'), async (req, res) => {
  try {
    const result = await executeSkill('trending_tokens', {});
    res.json({
      data: result.data || result,
      x402: { paid: req.x402?.paid },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/x402/price/:symbol — Token price with 24h change
router.get('/price/:symbol', x402Gate('price_check'), async (req, res) => {
  try {
    const result = await executeSkill('price_check', {
      symbol: req.params.symbol,
    });
    res.json({
      data: result.data || result,
      x402: { paid: req.x402?.paid },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/x402/research/:token — Deep token research with safety scoring
router.get('/research/:token', x402Gate('research'), async (req, res) => {
  try {
    const result = await executeSkill('token_research', {
      token: req.params.token,
    });
    res.json({
      data: result.data || result,
      x402: { paid: req.x402?.paid },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/x402/whale-alerts — Recent whale wallet movements
router.get('/whale-alerts', x402Gate('whale_alerts'), async (req, res) => {
  try {
    const result = await executeSkill('whale_watch', {});
    res.json({
      data: result.data || result,
      x402: { paid: req.x402?.paid },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/x402/history/:symbol — Historical price data (Powered by Allium)
router.get('/history/:symbol', x402Gate('history'), async (req, res) => {
  try {
    const result = await executeSkill('price_history', {
      token: req.params.symbol,
      timeframe: req.query.timeframe || '24h',
    });
    res.json({
      data: result.data || result,
      x402: { paid: req.x402?.paid },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/x402/news — Latest crypto news
router.get('/news', x402Gate('news'), async (req, res) => {
  try {
    const result = await executeSkill('news_digest', {});
    res.json({
      data: result.data || result,
      x402: { paid: req.x402?.paid },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// x402 DISCOVERY — Let other agents find our services
// ═══════════════════════════════════════

// GET /api/x402/.well-known/x402 — Service discovery
router.get('/.well-known/x402', (req, res) => {
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    x402Version: 2,
    name: 'OpenSeeker',
    description: 'Crypto AI companion with real-time Solana data — trending tokens, price feeds, token research, whale alerts, news, and historical data (Powered by Allium)',
    network: NETWORK,
    treasury: TREASURY_WALLET,
    asset: USDC_ADDRESS,
    endpoints: [
      {
        resource: `${baseUrl}/api/x402/trending`,
        method: 'GET',
        description: 'Live trending tokens from DexScreener with safety scoring',
        price: '$0.001 USDC',
        amount: PRICING.trending,
      },
      {
        resource: `${baseUrl}/api/x402/price/:symbol`,
        method: 'GET',
        description: 'Token price with 24h change, volume, market cap',
        price: '$0.0005 USDC',
        amount: PRICING.price_check,
      },
      {
        resource: `${baseUrl}/api/x402/research/:token`,
        method: 'GET',
        description: 'Deep token research with fundamentals, liquidity, and risk analysis',
        price: '$0.005 USDC',
        amount: PRICING.research,
      },
      {
        resource: `${baseUrl}/api/x402/whale-alerts`,
        method: 'GET',
        description: 'Recent whale wallet movements on Solana',
        price: '$0.002 USDC',
        amount: PRICING.whale_alerts,
      },
      {
        resource: `${baseUrl}/api/x402/news`,
        method: 'GET',
        description: 'Latest crypto news aggregated from multiple sources',
        price: '$0.001 USDC',
        amount: PRICING.news,
      },
      {
        resource: `${baseUrl}/api/x402/history/:symbol`,
        method: 'GET',
        description: 'Historical price data with OHLC (Powered by Allium). Query: ?timeframe=24h (1h|4h|24h|7d|30d)',
        price: '$0.003 USDC',
        amount: PRICING.history,
      },
    ],
  });
});

module.exports = router;
