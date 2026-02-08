const express = require('express');
const router = express.Router();
const {
  createReferralCode,
  getReferralCode,
  recordReferral,
  getReferralEarnings,
  getReferralCount,
  getUnpaidEarnings,
  getRecentEarnings,
  markEarningsPaid,
  getWalletByReferralCode,
} = require('../db');

const BASE_URL = process.env.REFERRAL_BASE_URL || 'https://openseeker.xyz';
const MIN_PAYOUT_SOL = 0.005;
const MIN_PAYOUT_USDC = 0.50;

// POST /api/referral/generate — Generate or get referral code
router.post('/generate', (req, res) => {
  try {
    const { wallet, custom_code } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });

    // Check if already has a code
    let code = getReferralCode(wallet);
    if (code) {
      return res.json({ code, link: `${BASE_URL}/ref/${code}` });
    }

    // Generate new code
    const result = createReferralCode(wallet, custom_code || null);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to generate code' });
    }

    res.json({ code: result.code, link: `${BASE_URL}/ref/${result.code}` });
  } catch (error) {
    console.error('[REFERRAL] Generate error:', error);
    res.status(500).json({ error: 'Failed to generate referral code' });
  }
});

// POST /api/referral/apply — Apply referral code during onboarding
router.post('/apply', (req, res) => {
  try {
    const { wallet, code } = req.body;
    if (!wallet || !code) return res.status(400).json({ error: 'wallet and code required' });

    // Look up referrer by code
    const referrerWallet = getWalletByReferralCode(code);
    if (!referrerWallet) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    if (referrerWallet === wallet) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    const result = recordReferral(referrerWallet, wallet, code);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      ok: true,
      referrer: referrerWallet.slice(0, 4) + '...' + referrerWallet.slice(-4),
    });
  } catch (error) {
    console.error('[REFERRAL] Apply error:', error);
    res.status(500).json({ error: 'Failed to apply referral code' });
  }
});

// GET /api/referral/stats — Get referral dashboard data
router.get('/stats', (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet query param required' });

    // Ensure user has a code
    let code = getReferralCode(wallet);
    if (!code) {
      const result = createReferralCode(wallet, null);
      code = result.code;
    }

    const referralCount = getReferralCount(wallet);
    const totalEarnings = getReferralEarnings(wallet);
    const unpaidEarnings = getUnpaidEarnings(wallet);
    const recentEarnings = getRecentEarnings(wallet);

    res.json({
      code,
      link: `${BASE_URL}/ref/${code}`,
      referralCount,
      totalEarnings,
      unpaidEarnings,
      recentEarnings,
    });
  } catch (error) {
    console.error('[REFERRAL] Stats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

// POST /api/referral/claim — Request payout of unpaid earnings
router.post('/claim', (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });

    const unpaid = getUnpaidEarnings(wallet);
    const solBalance = unpaid.SOL || 0;
    const usdcBalance = unpaid.USDC || 0;

    if (solBalance < MIN_PAYOUT_SOL && usdcBalance < MIN_PAYOUT_USDC) {
      return res.status(400).json({
        error: `Minimum payout: ${MIN_PAYOUT_SOL} SOL or $${MIN_PAYOUT_USDC} USDC`,
        unpaid,
      });
    }

    // For v1: mark as paid with placeholder signature (manual payout)
    const txSig = `manual_${Date.now()}_${wallet.slice(0, 8)}`;
    const result = markEarningsPaid(wallet, txSig);

    res.json({
      success: true,
      claimed: unpaid,
      txSignature: txSig,
      note: 'Payout queued for manual processing',
      marked: result.marked,
    });
  } catch (error) {
    console.error('[REFERRAL] Claim error:', error);
    res.status(500).json({ error: 'Failed to claim earnings' });
  }
});

module.exports = router;
