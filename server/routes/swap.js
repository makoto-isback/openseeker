const express = require('express');
const { getQuote, getSwapTransaction } = require('../services/jupiter');
const { x402 } = require('../middleware/x402');

const router = express.Router();

/**
 * POST /swap/swap-quote
 * Get a swap quote from Jupiter with x402 payment.
 */
router.post('/swap-quote', x402(0.003), async (req, res) => {
  try {
    const { from, to, amount, slippage } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({ error: 'from, to, and amount are required' });
    }

    const quote = await getQuote(from, to, parseFloat(amount), slippage ? parseInt(slippage) : 50);

    res.json({
      success: true,
      quote: {
        from: { symbol: from.toUpperCase(), amount: quote.inAmount },
        to: { symbol: to.toUpperCase(), amount: quote.outAmount },
        rate: quote.rate,
        price_impact: quote.priceImpact,
        min_received: quote.minReceived,
        slippage: quote.slippage,
        route: quote.route,
        source: quote.source,
      },
      rawResponse: quote.rawResponse || null,
    });
  } catch (error) {
    console.error('[Swap] Quote error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /swap/swap-execute
 * Get a serialized swap transaction from Jupiter.
 */
router.post('/swap-execute', x402(0.005), async (req, res) => {
  try {
    const { quoteResponse, userPublicKey } = req.body;

    if (!quoteResponse || !userPublicKey) {
      return res.status(400).json({ error: 'quoteResponse and userPublicKey are required' });
    }

    const txData = await getSwapTransaction(quoteResponse, userPublicKey);

    res.json({
      success: true,
      transaction: txData,
    });
  } catch (error) {
    console.error('[Swap] Execute error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
