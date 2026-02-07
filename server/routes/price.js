const express = require('express');
const { getPrice, getMarketData } = require('../services/priceCache');

const router = express.Router();

/**
 * GET /price/:symbol
 * Returns live price data (Jupiter primary, CoinGecko fallback).
 */
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const detailed = req.query.detailed === 'true';

  try {
    const data = detailed
      ? await getMarketData(symbol)
      : await getPrice(symbol);

    if (!data || !data.price) {
      return res.status(404).json({ error: `Price not found for ${symbol.toUpperCase()}` });
    }

    res.json({
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[Price] Error fetching ${symbol}:`, error.message);
    res.status(500).json({ error: `Failed to fetch price for ${symbol.toUpperCase()}` });
  }
});

module.exports = router;
