const express = require('express');
const { getPrices } = require('../services/priceCache');
const { callAI } = require('../services/ai');
const { x402 } = require('../middleware/x402');

const router = express.Router();

const MORNING_PROMPT = `You are DegenCat delivering a morning briefing to your owner.

{soul}

Generate a morning briefing covering:
1. Portfolio value and overnight changes
2. Top movers in their holdings
3. Any triggered alerts
4. Market mood (bullish/bearish/sideways)

Keep it under 200 words. Use your personality. Start with a morning greeting.`;

const NIGHT_PROMPT = `You are DegenCat delivering a daily wrap-up to your owner.

{soul}

Summarize the day:
1. Total P&L for the day
2. Best and worst performers in holdings
3. Key conversations and actions today
4. A brief outlook or goodnight message

Keep it under 200 words. Use your personality. End with a goodnight.`;

/**
 * POST /briefing
 *
 * Generate a morning or night briefing.
 */
router.post('/', x402(0.005), async (req, res) => {
  try {
    const {
      type = 'morning',
      soul = '',
      memory = '',
      wallet = '',
      daily_log = '',
      watched_tokens = [],
      portfolio_tokens = [],
    } = req.body;

    // Fetch current prices if we have tokens
    const tokenList = [...new Set([
      ...watched_tokens,
      ...portfolio_tokens.map((t) => t.symbol),
    ])];

    let prices = {};
    if (tokenList.length > 0) {
      try {
        prices = await getPrices(tokenList);
      } catch (error) {
        console.error('[Briefing] Price fetch failed:', error.message);
      }
    }

    // Calculate portfolio summary
    const holdings = [];
    let totalValue = 0;

    for (const token of portfolio_tokens) {
      const priceData = prices[token.symbol.toUpperCase()];
      if (priceData) {
        const value = token.amount * priceData.price;
        totalValue += value;
        holdings.push(`${token.symbol}: ${token.amount} @ $${priceData.price} (${priceData.change_24h > 0 ? '+' : ''}${priceData.change_24h.toFixed(1)}%) = $${value.toFixed(2)}`);
      }
    }

    const template = type === 'night' ? NIGHT_PROMPT : MORNING_PROMPT;
    const promptText = template.replace('{soul}', soul);

    const context = [
      `Portfolio total: $${totalValue.toFixed(2)}`,
      holdings.length > 0 ? `Holdings:\n${holdings.join('\n')}` : 'No holdings tracked.',
      memory ? `User memory:\n${memory}` : '',
      type === 'night' && daily_log ? `Today's activity log:\n${daily_log}` : '',
    ].filter(Boolean).join('\n\n');

    const messages = [
      { role: 'system', content: promptText },
      { role: 'user', content: context },
    ];

    const response = await callAI(messages);

    res.json({
      type,
      response,
      portfolio_value: totalValue,
      prices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Briefing] Error:', error.message);
    res.status(500).json({ error: 'Briefing generation failed' });
  }
});

module.exports = router;
