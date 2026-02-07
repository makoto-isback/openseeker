const express = require('express');
const { getPrice, getPrices, getMarketData, TOKEN_MINTS } = require('../services/priceCache');

const router = express.Router();

// GET /api/prices/mints — Token mint address map
router.get('/mints', (req, res) => {
  res.json(TOKEN_MINTS);
});

// GET /api/prices?symbols=SOL,WIF,BONK — Multiple prices
router.get('/', async (req, res) => {
  const { symbols } = req.query;
  if (!symbols) {
    return res.status(400).json({ error: 'symbols query param required (e.g. ?symbols=SOL,WIF,BONK)' });
  }

  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  if (symList.length === 0) {
    return res.status(400).json({ error: 'At least one symbol required' });
  }

  const prices = await getPrices(symList);
  res.json({ prices, timestamp: new Date().toISOString() });
});

// GET /api/prices/:symbol — Single price (with optional ?detailed=true)
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const detailed = req.query.detailed === 'true';

  try {
    const data = detailed
      ? await getMarketData(symbol)
      : await getPrice(symbol);

    if (!data) {
      return res.status(404).json({ error: `Price not found for ${symbol.toUpperCase()}` });
    }

    res.json({ ...data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(`[Prices] Error for ${symbol}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
