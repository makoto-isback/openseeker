const express = require('express');
const { getPrice, getMarketData } = require('../services/coingecko');

const router = express.Router();

/**
 * GET /price/:symbol
 *
 * Returns live price data from CoinGecko with 60s cache.
 * Falls back to mock data if CoinGecko is unavailable.
 */
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const detailed = req.query.detailed === 'true';

  try {
    const data = detailed
      ? await getMarketData(symbol)
      : await getPrice(symbol);

    res.json({
      ...data,
      timestamp: new Date().toISOString(),
      source: 'coingecko',
    });
  } catch (error) {
    console.error(`[Price] Error fetching ${symbol}:`, error.message);

    // Fallback to mock data if CoinGecko fails
    const mockPrices = {
      SOL: { price: 178.42, change_24h: 3.2 },
      BTC: { price: 97500.00, change_24h: 1.1 },
      ETH: { price: 3450.00, change_24h: -0.8 },
      WIF: { price: 2.15, change_24h: 12.5 },
      BONK: { price: 0.0000234, change_24h: -5.3 },
    };

    const upper = symbol.toUpperCase();
    const mock = mockPrices[upper];

    if (!mock) {
      return res.status(404).json({ error: `Price not found for ${upper}` });
    }

    res.json({
      symbol: upper,
      ...mock,
      timestamp: new Date().toISOString(),
      source: 'mock',
    });
  }
});

module.exports = router;
