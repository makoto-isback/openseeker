/**
 * Balance Routes
 * GET /balance/:wallet — get user balance and stats
 */
const express = require('express');
const { getUser, getSpendStats } = require('../db');

const router = express.Router();

/**
 * GET /balance/:wallet
 * Returns user balance, total deposited, total spent, and recent usage stats.
 */
router.get('/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet || wallet.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const user = getUser(wallet);

    if (!user) {
      // User doesn't exist yet — return zero balances
      return res.json({
        wallet,
        balance: 0,
        total_deposited: 0,
        total_spent: 0,
        usage_today: 0,
        usage_month: 0,
        exists: false,
      });
    }

    // Get usage stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const todayStats = getSpendStats(wallet, todayStart);
    const monthStats = getSpendStats(wallet, monthStart);

    res.json({
      wallet,
      balance: user.balance_usdc,
      total_deposited: user.total_deposited,
      total_spent: user.total_spent,
      usage_today: todayStats?.total || 0,
      usage_month: monthStats?.total || 0,
      requests_today: todayStats?.count || 0,
      requests_month: monthStats?.count || 0,
      exists: true,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (error) {
    console.error('[Balance] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

module.exports = router;
