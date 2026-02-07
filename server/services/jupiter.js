/**
 * Jupiter API Service — Real Swap Integration
 *
 * Uses Jupiter's Swap API for:
 * - Getting quotes (price discovery)
 * - Getting serialized swap transactions (for user to sign)
 */

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_API = 'https://api.jup.ag/swap/v1/swap';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || 'ce8c789c-1bcd-4437-87e9-529fc7605963';

// Referral — 0.25% platform fee on all swaps
const REFERRAL_ACCOUNT = 'FqQ7qbKWi8yYXFbbwDvPbqcwbKzyu5CLa7hFLRh58yc5';
const PLATFORM_FEE_BPS = 25; // 0.25%

// Symbol → Solana mint address mapping
const MINT_MAP = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JITO: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  JITOSOLSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  BSOL: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  INF: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm',
  HNT: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
  RNDR: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
};

// Decimals for each token
const DECIMALS = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  WIF: 6,
  JUP: 6,
  BONK: 5,
  PYTH: 6,
  RAY: 6,
  ORCA: 6,
  MSOL: 9,
  JITO: 9,
  JITOSOLSOL: 9,
  BSOL: 9,
  INF: 9,
  HNT: 8,
  RNDR: 8,
};

// Mock rates for fallback when Jupiter API is unavailable
const MOCK_RATES = {
  'SOL/USDC': 78.0,
  'SOL/WIF': 350.0,
  'SOL/BONK': 2800000,
  'SOL/JUP': 95.0,
  'WIF/USDC': 0.22,
  'BONK/USDC': 0.000028,
  'USDC/SOL': 0.0128,
};

function getMint(symbol) {
  return MINT_MAP[symbol.toUpperCase()];
}

function getDecimals(symbol) {
  return DECIMALS[symbol.toUpperCase()] || 9;
}

/**
 * Get a swap quote from Jupiter.
 * Returns pricing info without creating a transaction.
 */
async function getQuote(fromSymbol, toSymbol, amount, slippageBps = 50) {
  const from = fromSymbol.toUpperCase();
  const to = toSymbol.toUpperCase();

  const inputMint = getMint(from);
  const outputMint = getMint(to);

  if (!inputMint) throw new Error(`Unknown token: ${from}`);
  if (!outputMint) throw new Error(`Unknown token: ${to}`);

  const inputDecimals = getDecimals(from);
  const outputDecimals = getDecimals(to);
  const amountLamports = Math.round(amount * 10 ** inputDecimals);

  // Try live Jupiter API first
  try {
    const url = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&platformFeeBps=${PLATFORM_FEE_BPS}`;
    console.log(`[Jupiter] Quote request: ${from} → ${to}, amount: ${amount}`);

    const res = await fetch(url, {
      headers: { 'x-api-key': JUPITER_API_KEY },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const outAmount = parseInt(data.outAmount) / 10 ** outputDecimals;
      const inAmount = parseInt(data.inAmount) / 10 ** inputDecimals;
      const minReceived = parseInt(data.otherAmountThreshold || data.outAmount) / 10 ** outputDecimals;
      const route = data.routePlan
        ?.map((r) => r.swapInfo?.label)
        .filter(Boolean)
        .join(' → ') || 'Direct';

      console.log(`[Jupiter] Quote: ${inAmount} ${from} → ${outAmount.toFixed(6)} ${to}`);

      return {
        inAmount,
        outAmount,
        rate: outAmount / inAmount,
        priceImpact: parseFloat(data.priceImpactPct || '0'),
        minReceived,
        slippage: `${slippageBps / 100}%`,
        route,
        source: 'jupiter',
        rawResponse: data, // Needed for swap transaction
      };
    } else {
      const error = await res.text();
      console.log(`[Jupiter] Quote API error: ${res.status} - ${error}`);
    }
  } catch (err) {
    console.log(`[Jupiter] Quote API unavailable: ${err.message}, using mock`);
  }

  // Mock fallback for demos
  return getMockQuote(from, to, amount, slippageBps);
}

/**
 * Get a serialized swap transaction from Jupiter.
 * The transaction is unsigned — user must sign with their wallet.
 *
 * @param quoteResponse - Raw quote response from getQuote()
 * @param userPublicKey - User's wallet address (base58)
 * @returns Object with swapTransaction (base64) and metadata
 */
async function getSwapTransaction(quoteResponse, userPublicKey) {
  // If we have a real quote, get the real transaction
  if (quoteResponse && quoteResponse.source !== 'mock') {
    try {
      console.log(`[Jupiter] Getting swap transaction for ${userPublicKey.slice(0, 8)}...`);

      const res = await fetch(JUPITER_SWAP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': JUPITER_API_KEY },
        body: JSON.stringify({
          quoteResponse: quoteResponse.rawResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          feeAccount: REFERRAL_ACCOUNT,
          // Optimization for better transaction landing
          dynamicComputeUnitLimit: true,
          dynamicSlippage: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1000000, // Max 0.001 SOL priority fee
              priorityLevel: 'high',
            },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[Jupiter] Swap transaction created, size: ${data.swapTransaction?.length || 0} bytes`);

        return {
          swapTransaction: data.swapTransaction, // Base64 encoded
          lastValidBlockHeight: data.lastValidBlockHeight,
          source: 'jupiter',
          // Include quote info for display
          inputMint: quoteResponse.rawResponse?.inputMint,
          outputMint: quoteResponse.rawResponse?.outputMint,
        };
      } else {
        const error = await res.text();
        console.error(`[Jupiter] Swap API error: ${res.status} - ${error}`);
        throw new Error(`Jupiter swap failed: ${error}`);
      }
    } catch (err) {
      console.error(`[Jupiter] Swap transaction error: ${err.message}`);
      throw err;
    }
  }

  // Mock fallback — return a fake transaction for demo
  console.log('[Jupiter] Using mock swap transaction');
  return {
    swapTransaction: null,
    lastValidBlockHeight: null,
    source: 'mock',
    note: 'Mock transaction - no real swap will occur',
  };
}

/**
 * Generate mock quote for demos when Jupiter is unavailable.
 */
function getMockQuote(from, to, amount, slippageBps) {
  const pair = `${from}/${to}`;
  const reversePair = `${to}/${from}`;
  let rate = MOCK_RATES[pair];

  if (!rate && MOCK_RATES[reversePair]) {
    rate = 1 / MOCK_RATES[reversePair];
  }

  if (!rate) {
    // Try to derive via USDC
    const fromUsd = MOCK_RATES[`${from}/USDC`] || (1 / (MOCK_RATES[`USDC/${from}`] || 0));
    const toUsd = MOCK_RATES[`${to}/USDC`] || (1 / (MOCK_RATES[`USDC/${to}`] || 0));
    if (fromUsd && toUsd && isFinite(fromUsd) && isFinite(toUsd)) {
      rate = fromUsd / toUsd;
    } else {
      rate = 1;
    }
  }

  const outAmount = amount * rate;
  const minReceived = outAmount * (1 - slippageBps / 10000);

  return {
    inAmount: amount,
    outAmount,
    rate,
    priceImpact: 0.1,
    minReceived,
    slippage: `${slippageBps / 100}%`,
    route: 'Simulated Route',
    source: 'mock',
    rawResponse: null,
  };
}

module.exports = {
  getQuote,
  getSwapTransaction,
  getMint,
  getDecimals,
  MINT_MAP,
  DECIMALS,
};
