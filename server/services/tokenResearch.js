const { getMarketData, SYMBOL_MAP } = require('./coingecko');

// Tokens on Jupiter's verified/strict list (known safe tokens)
const JUPITER_STRICT_LIST = new Set([
  'SOL', 'USDC', 'USDT', 'BTC', 'ETH', 'WIF', 'JUP', 'BONK',
  'PYTH', 'RAY', 'ORCA', 'MSOL', 'JITO', 'HNT', 'RNDR',
]);

/**
 * Analyze a token for safety and information.
 */
async function analyze(symbol) {
  const upper = symbol.toUpperCase();
  let marketData = null;

  try {
    marketData = await getMarketData(upper);
  } catch {
    // Token may not be on CoinGecko
  }

  const price = marketData?.price || 0;
  const marketCap = marketData?.market_cap || 0;
  const volume = marketData?.volume_24h || 0;
  const change24h = marketData?.change_24h || 0;

  const onStrictList = JUPITER_STRICT_LIST.has(upper);

  // Calculate safety score (1-10)
  let score = 0;
  const flags = [];

  if (onStrictList) {
    score += 3;
  } else {
    flags.push('not_on_jupiter_verified');
  }

  if (marketCap > 10_000_000) {
    score += 2;
  } else if (marketCap > 0) {
    flags.push('low_market_cap');
  } else {
    flags.push('unknown_market_cap');
  }

  if (volume > 1_000_000) {
    score += 2;
  } else if (volume > 0) {
    flags.push('low_volume');
  } else {
    flags.push('unknown_volume');
  }

  // Volume/MCap ratio check
  if (marketCap > 0 && volume / marketCap > 0.1) {
    score += 1;
  }

  // Trend check
  if (change24h > 0) {
    score += 1;
  }

  // Known token bonus
  if (SYMBOL_MAP[upper]) {
    score += 1;
  }

  // Cap at 10
  score = Math.min(score, 10);

  // Determine verdict
  let verdict;
  if (score >= 8) {
    verdict = 'Looks safe — established token';
  } else if (score >= 5) {
    verdict = 'Proceed with caution — moderate risk';
  } else if (score >= 3) {
    verdict = 'High risk — do your own research';
  } else {
    verdict = 'Very high risk — could be a scam';
  }

  return {
    symbol: upper,
    name: upper, // CoinGecko free API doesn't return name in simple endpoint
    price,
    marketCap,
    volume,
    change24h,
    safetyScore: score,
    flags,
    onStrictList,
    verdict,
  };
}

module.exports = { analyze };
