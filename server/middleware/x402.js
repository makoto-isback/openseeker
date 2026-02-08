/**
 * x402 Payment Middleware — Dual Mode
 *
 * Mode 1 — Real x402 Protocol (Coinbase facilitator):
 *   Requests with PAYMENT-SIGNATURE header are verified+settled via x402.org facilitator.
 *   This is the standard x402 protocol: 402 → sign USDC transfer → retry with header.
 *
 * Mode 2 — Credit System (pre-deposit):
 *   Requests with X-Wallet header use server-side SQLite balance tracking.
 *   User deposits SOL/USDC upfront, server deducts per-request.
 *
 * Mode 3 — Test Mode:
 *   Requests with X-Payment "test:wallet:timestamp" for demos.
 */
const { getOrCreateUser, deductSpend, getReferrer, recordReferralEarning } = require('../db');

const PRICE_TABLE = {
  '/chat': 0.002,
  '/heartbeat': 0.002,
  '/briefing': 0.005,
  '/swap/swap-quote': 0.003,
  '/swap/swap-execute': 0.005,
  '/park/generate': 0.005,
};

const DEPOSIT_WALLET = process.env.DEPOSIT_WALLET || 'BxRG4VDK9rjHRoDH7VrT7nz7uiBPujx98azqBH6wvXAn';
const X402_MODE = process.env.X402_MODE || 'production';
const USDC_MINT = process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * Create per-route x402 credit middleware.
 * Usage: router.post('/', x402(0.002), handler)
 */
function x402(price) {
  return function x402Handler(req, res, next) {
    // Skip if already handled by real x402 middleware
    if (req.x402Settled) {
      return next();
    }

    const wallet = req.headers['x-wallet'];
    const payment = req.headers['x-payment'];

    // === Credit Mode: X-Wallet header present ===
    if (wallet) {
      return handleCreditMode(req, res, next, wallet, price);
    }

    // === Test Mode Fallback: X-Payment header with test format ===
    if (payment && X402_MODE === 'test') {
      return handleTestMode(req, res, next, payment, price);
    }

    // === No valid auth: Return 402 ===
    return res.status(402).json({
      status: 402,
      message: 'Payment Required',
      price,
      currency: 'USDC',
      network: 'solana',
      deposit_address: DEPOSIT_WALLET,
      usdc_mint: USDC_MINT,
      accepts_test: X402_MODE === 'test',
      instructions: 'Send X-Wallet header with your Solana wallet address. Deposit USDC first via /deposit endpoints.',
    });
  };
}

/**
 * Handle credit-based payment (production mode).
 */
function handleCreditMode(req, res, next, wallet, price) {
  if (wallet.length < 32 || wallet.length > 44) {
    return res.status(400).json({
      error: 'Invalid wallet address format',
    });
  }

  const user = getOrCreateUser(wallet);

  if (user.balance_usdc < price) {
    return res.status(402).json({
      status: 402,
      message: 'Insufficient balance',
      balance: user.balance_usdc,
      price,
      shortfall: price - user.balance_usdc,
      currency: 'USDC',
      deposit_address: DEPOSIT_WALLET,
      usdc_mint: USDC_MINT,
      instructions: `Deposit at least $${(price - user.balance_usdc).toFixed(4)} USDC to continue.`,
    });
  }

  const result = deductSpend(wallet, req.path, price);
  if (!result.success) {
    return res.status(402).json({
      status: 402,
      message: result.error,
      balance: result.balance,
      price,
    });
  }

  req.paymentAmount = price;
  req.paymentVerified = true;
  req.userWallet = wallet;
  req.newBalance = result.newBalance;

  // Track referral earning (10% revenue share)
  try {
    const referrer = getReferrer(wallet);
    if (referrer) {
      const referralAmount = price * 0.10;
      recordReferralEarning(referrer, wallet, req.path, price, referralAmount, 'USDC');
    }
  } catch (e) { /* non-blocking */ }

  console.log(`[x402] ${req.path} — $${price} from ${wallet.slice(0, 8)}... (balance: $${result.newBalance.toFixed(4)})`);
  next();
}

/**
 * Handle test payment (demo mode).
 * Format: "test:{walletAddress}:{timestamp}"
 */
function handleTestMode(req, res, next, payment, price) {
  const parts = payment.split(':');
  if (parts.length !== 3 || parts[0] !== 'test') {
    return res.status(402).json({
      status: 402,
      message: 'Invalid test payment format. Expected: test:{wallet}:{timestamp}',
      price,
      accepts_test: true,
    });
  }

  const wallet = parts[1];
  const timestamp = parseInt(parts[2], 10);

  if (!wallet || wallet.length < 10) {
    return res.status(402).json({
      status: 402,
      message: 'Invalid wallet address in test payment',
      price,
    });
  }

  if (isNaN(timestamp)) {
    return res.status(402).json({
      status: 402,
      message: 'Invalid timestamp in test payment',
      price,
    });
  }

  const age = Math.abs(Date.now() - timestamp);
  if (age > 60000) {
    return res.status(402).json({
      status: 402,
      message: 'Test payment expired (>60s)',
      price,
    });
  }

  req.paymentAmount = price;
  req.paymentVerified = true;
  req.userWallet = wallet;
  req.testMode = true;

  console.log(`[x402] ${req.path} — $${price} (TEST MODE) from ${wallet.slice(0, 8)}...`);
  next();
}

/**
 * Get the price for a given route path.
 */
function getRoutePrice(path) {
  return PRICE_TABLE[path] || 0.002;
}

/**
 * Build the real x402 payment middleware using Coinbase facilitator.
 * Returns an Express middleware that handles the x402 protocol for real USDC payments.
 * Falls through to credit system if no PAYMENT-SIGNATURE header is present.
 */
function buildRealX402Middleware() {
  try {
    const { paymentMiddleware } = require('@x402/express');
    const { HTTPFacilitatorClient, x402ResourceServer } = require('@x402/core/server');
    const { registerExactSvmScheme } = require('@x402/svm/exact/server');
    const { SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2 } = require('@x402/svm');

    const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
    const PAY_TO = process.env.X402_PAY_TO || DEPOSIT_WALLET;
    const IS_MAINNET = process.env.SOLANA_NETWORK === 'mainnet';
    const NETWORK = IS_MAINNET ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;

    // Create facilitator client
    const facilitatorClient = new HTTPFacilitatorClient(FACILITATOR_URL);

    // Create resource server and register SVM exact scheme
    const server = new x402ResourceServer(facilitatorClient);
    registerExactSvmScheme(server);

    // Build route config for all paid endpoints
    const USDC_ASSET = IS_MAINNET
      ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    const routes = {};
    for (const [path, price] of Object.entries(PRICE_TABLE)) {
      const method = 'POST';
      routes[`${method} ${path}`] = {
        accepts: {
          scheme: 'exact',
          network: NETWORK,
          asset: USDC_ASSET,
          amount: String(Math.round(price * 1e6)), // USDC has 6 decimals
          payTo: PAY_TO,
          maxTimeoutSeconds: 60,
        },
        description: `OpenSeeker ${path} endpoint`,
      };
    }

    const realMiddleware = paymentMiddleware(routes, server);

    console.log(`[x402] Real x402 middleware initialized (facilitator: ${FACILITATOR_URL}, network: ${NETWORK})`);

    // Wrap: only invoke real x402 if PAYMENT-SIGNATURE header is present
    return (req, res, next) => {
      const hasPaymentSig = req.headers['payment-signature'] || req.headers['x-payment-signature'];
      const hasWallet = req.headers['x-wallet'];

      // If X-Wallet header is present (credit system), skip real x402
      if (hasWallet && !hasPaymentSig) {
        return next();
      }

      // If PAYMENT-SIGNATURE is present, use real x402 protocol
      if (hasPaymentSig) {
        return realMiddleware(req, res, (err) => {
          if (err) return next(err);
          req.x402Settled = true;
          req.paymentVerified = true;
          next();
        });
      }

      // No payment headers at all — fall through to per-route middleware
      next();
    };
  } catch (error) {
    console.warn(`[x402] Real x402 middleware not available: ${error.message}`);
    console.warn('[x402] Falling back to credit-only mode');
    return (req, res, next) => next();
  }
}

module.exports = { x402, getRoutePrice, PRICE_TABLE, DEPOSIT_WALLET, USDC_MINT, buildRealX402Middleware };
