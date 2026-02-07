/**
 * Whale Watch Service
 *
 * Uses mock data for hackathon demo. The architecture supports real
 * Helius/Birdeye/Solscan API integration when API keys are available.
 */

/**
 * Get recent large transfers for a token.
 * Currently returns mock data — replace with real API when available.
 */
async function getRecentLargeTransfers(token) {
  // Mock whale activity for demo
  const symbol = token.toUpperCase();
  const now = Date.now();

  const mockActivity = {
    SOL: {
      recent_large_txs: [
        { type: 'transfer', amount: 25000, value_usd: 2125000, from: '7xKX...3fAe', to: 'Jupiter Aggregator', time_ago: '1h ago', direction: 'sell' },
        { type: 'transfer', amount: 50000, value_usd: 4250000, from: 'Binance Hot', to: '9pQm...7kLd', time_ago: '3h ago', direction: 'accumulate' },
        { type: 'transfer', amount: 15000, value_usd: 1275000, from: '4rTy...8nWq', to: 'Raydium LP', time_ago: '6h ago', direction: 'provide_liquidity' },
      ],
      whale_holdings_change_24h: '+1.8%',
      notable: 'Net accumulation by large wallets',
    },
    WIF: {
      recent_large_txs: [
        { type: 'transfer', amount: 500000, value_usd: 125000, from: '3mNx...5pRz', to: 'Jupiter Aggregator', time_ago: '2h ago', direction: 'sell' },
        { type: 'transfer', amount: 2000000, value_usd: 500000, from: 'Coinbase', to: 'Hb7j...2aQw', time_ago: '5h ago', direction: 'accumulate' },
        { type: 'transfer', amount: 1000000, value_usd: 250000, from: '6kYz...9eTp', to: 'Orca LP', time_ago: '8h ago', direction: 'provide_liquidity' },
      ],
      whale_holdings_change_24h: '+2.3%',
      notable: 'Large accumulation from exchange withdrawals',
    },
  };

  // Default mock for unknown tokens
  const defaultMock = {
    recent_large_txs: [
      { type: 'transfer', amount: 10000, value_usd: 50000, from: '5xAb...7cDe', to: 'DEX', time_ago: '4h ago', direction: 'sell' },
      { type: 'transfer', amount: 20000, value_usd: 100000, from: 'Exchange', to: '8fGh...3iJk', time_ago: '7h ago', direction: 'accumulate' },
    ],
    whale_holdings_change_24h: '+0.5%',
    notable: 'Moderate activity, nothing unusual',
  };

  const activity = mockActivity[symbol] || defaultMock;

  return {
    token: symbol,
    ...activity,
    source: 'mock',
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getRecentLargeTransfers };
