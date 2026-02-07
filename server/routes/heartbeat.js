const express = require('express');
const { getPrices } = require('../services/coingecko');
const { callAI } = require('../services/ai');
const { x402 } = require('../middleware/x402');

const router = express.Router();

/**
 * POST /heartbeat
 *
 * Processes a heartbeat check: fetches prices, evaluates portfolio,
 * checks alerts, and generates a notification if anything notable.
 */
router.post('/', x402(0.002), async (req, res) => {
  try {
    const {
      soul = '',
      memory = '',
      wallet = '',
      watched_tokens = [],
      alerts = [],
      portfolio_tokens = [],
    } = req.body;

    // 1. Fetch current prices for watched tokens
    const tokenList = [...new Set([
      ...watched_tokens,
      ...portfolio_tokens.map((t) => t.symbol),
      ...alerts.map((a) => a.token),
    ])];

    let prices = {};
    if (tokenList.length > 0) {
      try {
        prices = await getPrices(tokenList);
      } catch (error) {
        console.error('[Heartbeat] Price fetch failed:', error.message);
      }
    }

    // 2. Calculate portfolio value and changes
    let totalValue = 0;
    let totalCostBasis = 0;
    const holdings = [];

    for (const token of portfolio_tokens) {
      const priceData = prices[token.symbol.toUpperCase()];
      if (priceData) {
        const currentValue = token.amount * priceData.price;
        const costBasis = token.amount * token.avg_entry;
        const pnl = currentValue - costBasis;
        const pnlPercent = costBasis > 0 ? ((pnl / costBasis) * 100) : 0;

        totalValue += currentValue;
        totalCostBasis += costBasis;

        holdings.push({
          symbol: token.symbol,
          amount: token.amount,
          price: priceData.price,
          change_24h: priceData.change_24h,
          value: currentValue,
          pnl,
          pnl_percent: pnlPercent,
        });
      }
    }

    const portfolioChange = totalCostBasis > 0
      ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
      : 0;

    // 3. Check alert conditions
    const triggeredAlerts = [];
    for (const alert of alerts) {
      const priceData = prices[alert.token.toUpperCase()];
      if (!priceData) continue;

      const triggered =
        (alert.condition === 'above' && priceData.price >= alert.price) ||
        (alert.condition === 'below' && priceData.price <= alert.price);

      if (triggered) {
        triggeredAlerts.push({
          ...alert,
          current_price: priceData.price,
        });
      }
    }

    // 4. Check for notable moves (>5% change in any watched token)
    const bigMovers = [];
    for (const [symbol, data] of Object.entries(prices)) {
      if (Math.abs(data.change_24h) >= 5) {
        bigMovers.push({ symbol, change: data.change_24h, price: data.price });
      }
    }

    // 5. Decision: is anything notable?
    const isNotable =
      Math.abs(portfolioChange) >= 2 ||
      triggeredAlerts.length > 0 ||
      bigMovers.length > 0;

    if (!isNotable) {
      return res.json({
        status: 'HEARTBEAT_OK',
        notify: false,
        timestamp: new Date().toISOString(),
        portfolio_value: totalValue,
        portfolio_change: portfolioChange,
        prices,
      });
    }

    // 6. Generate AI notification message
    const findings = [];
    if (Math.abs(portfolioChange) >= 2) {
      findings.push(`Portfolio ${portfolioChange > 0 ? 'up' : 'down'} ${Math.abs(portfolioChange).toFixed(1)}% (now $${totalValue.toFixed(2)})`);
    }
    for (const alert of triggeredAlerts) {
      findings.push(`ALERT: ${alert.token} hit $${alert.current_price} (target was ${alert.condition} $${alert.price})`);
    }
    for (const mover of bigMovers) {
      findings.push(`${mover.symbol} moved ${mover.change > 0 ? '+' : ''}${mover.change.toFixed(1)}% to $${mover.price}`);
    }

    const heartbeatPrompt = [
      { role: 'system', content: `You are DegenCat doing a routine check-in for your owner.\n\n${soul}\n\nCurrent findings:\n${findings.join('\n')}\n\nGenerate a SHORT push notification message (max 50 words).\nBe concise. Use your personality. Only mention what's important.` },
      { role: 'user', content: 'What should I know right now?' },
    ];

    let message = findings.join('; ');
    try {
      message = await callAI(heartbeatPrompt);
    } catch (error) {
      console.error('[Heartbeat] AI generation failed, using raw findings:', error.message);
    }

    const triggers = [
      ...triggeredAlerts.map((a) => `alert:${a.token}:${a.condition}:${a.price}`),
      ...bigMovers.map((m) => `mover:${m.symbol}:${m.change.toFixed(1)}%`),
      ...(Math.abs(portfolioChange) >= 2 ? [`portfolio:${portfolioChange.toFixed(1)}%`] : []),
    ];

    res.json({
      status: 'ALERT',
      notify: true,
      message,
      triggers,
      timestamp: new Date().toISOString(),
      portfolio_value: totalValue,
      portfolio_change: portfolioChange,
      prices,
      triggered_alerts: triggeredAlerts,
    });
  } catch (error) {
    console.error('[Heartbeat] Error:', error.message);
    res.status(500).json({ error: 'Heartbeat processing failed' });
  }
});

module.exports = router;
