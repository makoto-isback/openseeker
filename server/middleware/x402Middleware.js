/**
 * x402 Standard Middleware (PayAI + x402-solana)
 *
 * Express middleware that gates endpoints behind x402 USDC payments.
 * Supports three payment paths:
 *   1. Free tier — first 100 messages per wallet (opt-in per route)
 *   2. x402 standard — PAYMENT-SIGNATURE header verified via PayAI facilitator
 *   3. Legacy credit — X-Wallet header with SQLite balance (backward compat)
 *
 * Usage:
 *   router.post('/chat', x402Gate('chat_standard', { freeMessages: true }), handler);
 *   router.get('/trending', x402Gate('trending'), handler);
 */
const { x402Handler, createRequirements, PRICING } = require('../services/x402Handler');
const { getFreeMessagesRemaining, decrementFreeMessages, logX402Payment } = require('../db');
const { getOrCreateUser, deductSpend } = require('../db');

/**
 * Create x402 gate middleware for an Express route.
 *
 * @param {string} tier - Pricing tier key from PRICING object
 * @param {object} options
 * @param {boolean} options.freeMessages - Check free message quota before charging
 */
function x402Gate(tier, options = {}) {
  return async (req, res, next) => {
    try {
      const walletAddress = req.headers['x-wallet'] || req.body?.wallet_address || '';

      // === Path 1: Free messages (opt-in) ===
      if (options.freeMessages && walletAddress) {
        const remaining = getFreeMessagesRemaining(walletAddress);
        if (remaining > 0) {
          decrementFreeMessages(walletAddress);
          req.x402 = { paid: false, free: true, freeRemaining: remaining - 1 };
          return next();
        }
      }

      // === Path 2: x402 standard (PAYMENT-SIGNATURE header) ===
      if (x402Handler) {
        const paymentHeader = x402Handler.extractPayment(req.headers);

        if (paymentHeader) {
          const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
          const resourceUrl = `${baseUrl}${req.originalUrl}`;
          const requirements = await createRequirements(tier, resourceUrl);

          if (requirements) {
            try {
              const verified = await x402Handler.verifyPayment(paymentHeader, requirements);
              if (verified && verified.isValid) {
                // Settle payment
                try {
                  await x402Handler.settlePayment(paymentHeader, requirements);
                } catch (settleErr) {
                  console.warn('[x402Gate] Settlement error (proceeding):', settleErr.message);
                }

                logX402Payment(walletAddress, req.path, PRICING[tier] || '0', verified.transaction || '');

                req.x402 = {
                  paid: true,
                  free: false,
                  amount: PRICING[tier],
                  txSignature: verified.transaction || null,
                };
                console.log(`[x402Gate] ${req.path} — ${PRICING[tier]} atomic USDC via x402 standard`);
                return next();
              }
            } catch (verifyErr) {
              console.error('[x402Gate] Verification error:', verifyErr.message);
              return res.status(402).json({
                error: 'Payment verification failed',
                details: verifyErr.message,
                x402Version: 2,
              });
            }

            // Payment present but invalid
            return res.status(402).json({
              error: 'Payment verification failed',
              x402Version: 2,
            });
          }
        }
      }

      // === Path 3: Legacy credit system (X-Wallet header) ===
      if (walletAddress && walletAddress.length >= 32) {
        const priceUsd = parseInt(PRICING[tier] || '2000') / 1_000_000;
        const user = getOrCreateUser(walletAddress);

        if (user.balance_usdc >= priceUsd) {
          const result = deductSpend(walletAddress, req.path, priceUsd);
          if (result.success) {
            req.x402 = { paid: true, free: false, amount: PRICING[tier], legacy: true };
            req.paymentVerified = true;
            req.userWallet = walletAddress;
            req.newBalance = result.newBalance;
            console.log(`[x402Gate] ${req.path} — $${priceUsd} legacy credit from ${walletAddress.slice(0, 8)}...`);
            return next();
          }
        }

        // Legacy user with insufficient balance — fall through to 402
      }

      // === Path 4: No valid payment — return 402 ===
      if (x402Handler) {
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const resourceUrl = `${baseUrl}${req.originalUrl}`;
        const requirements = await createRequirements(tier, resourceUrl);

        if (requirements) {
          const response402 = x402Handler.create402Response(requirements, resourceUrl);
          return res.status(402).json(response402.body);
        }
      }

      // Fallback 402 if x402Handler not available
      return res.status(402).json({
        status: 402,
        message: 'Payment Required',
        tier,
        price_usdc: parseInt(PRICING[tier] || '2000') / 1_000_000,
        x402Version: 2,
        instructions: 'Send PAYMENT-SIGNATURE header with x402 standard payment, or X-Wallet header with funded wallet.',
      });
    } catch (err) {
      console.error('[x402Gate] Unexpected error:', err.message);
      return res.status(500).json({ error: 'Payment processing error' });
    }
  };
}

module.exports = { x402Gate };
