/**
 * x402 Standard Payment Handler (PayAI + x402-solana)
 *
 * Uses the x402-solana SDK for standard HTTP 402 payments.
 * PayAI facilitator verifies and settles USDC transfers on Solana.
 */
const { X402PaymentHandler } = require('x402-solana/server');

// Treasury wallet — receives all USDC payments
const TREASURY_WALLET = process.env.TREASURY_WALLET ||
  '98UP3QVTsAkmJGKjhE4w6GeZNn4csUfLY6C8TdQ1p3PK';

// USDC mint addresses
const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

const isDevnet = process.env.SOLANA_NETWORK !== 'mainnet';
const USDC_ADDRESS = isDevnet ? USDC_DEVNET : USDC_MAINNET;
const NETWORK = isDevnet ? 'solana-devnet' : 'solana';

// Initialize x402 payment handler
let x402Handler = null;
try {
  x402Handler = new X402PaymentHandler({
    network: NETWORK,
    treasuryAddress: TREASURY_WALLET,
    facilitatorUrl: 'https://facilitator.payai.network',
  });
  console.log(`[x402-solana] Payment handler initialized (network: ${NETWORK}, treasury: ${TREASURY_WALLET.slice(0, 8)}...)`);
} catch (err) {
  console.warn(`[x402-solana] Failed to initialize payment handler: ${err.message}`);
  console.warn('[x402-solana] x402 standard payments will not be available');
}

// Pricing tiers — amounts in USDC atomic units (6 decimals)
// $0.0005 = 500, $0.001 = 1000, $0.002 = 2000, $0.005 = 5000
const PRICING = {
  chat_standard: '2000',    // $0.002 per message
  chat_smart: '5000',       // $0.005 per smart model message
  heartbeat: '2000',        // $0.002
  briefing: '5000',         // $0.005
  swap_quote: '3000',       // $0.003
  swap_execute: '5000',     // $0.005
  park_generate: '5000',    // $0.005
  whale_watch: '2000',      // $0.002
  // Public API tiers (for other agents)
  trending: '1000',         // $0.001
  price_check: '500',       // $0.0005
  research: '5000',         // $0.005
  whale_alerts: '2000',     // $0.002
  news: '1000',             // $0.001
};

/**
 * Create x402 payment requirements for a given pricing tier.
 * Returns null if handler is not available or tier is free.
 */
async function createRequirements(tier, resourceUrl) {
  if (!x402Handler) return null;

  const amount = PRICING[tier];
  if (!amount) return null;

  try {
    return await x402Handler.createPaymentRequirements(
      {
        amount,
        asset: {
          address: USDC_ADDRESS,
          decimals: 6,
        },
        description: `OpenSeeker API: ${tier}`,
      },
      resourceUrl,
    );
  } catch (err) {
    console.error(`[x402-solana] Failed to create requirements for ${tier}:`, err.message);
    return null;
  }
}

module.exports = {
  x402Handler,
  PRICING,
  TREASURY_WALLET,
  USDC_ADDRESS,
  NETWORK,
  createRequirements,
};
