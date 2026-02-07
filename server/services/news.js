/**
 * Crypto News Service
 *
 * Uses CoinGecko trending endpoint as a proxy for "what's hot".
 * Falls back to mock data if API is unavailable.
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

let newsCache = null;
let newsCacheTime = 0;
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 min cache

/**
 * Get latest crypto news/trending topics.
 */
async function getNews(topic, limit = 5) {
  // Try CoinGecko trending first
  try {
    if (newsCache && Date.now() - newsCacheTime < NEWS_CACHE_TTL) {
      return filterByTopic(newsCache, topic, limit);
    }

    const res = await fetch(`${COINGECKO_BASE}/search/trending`);
    if (!res.ok) throw new Error(`CoinGecko trending error: ${res.status}`);

    const data = await res.json();
    const articles = [];

    // Convert trending coins into news-like items
    if (data.coins) {
      for (const { item } of data.coins.slice(0, 10)) {
        articles.push({
          title: `${item.name} (${item.symbol}) trending — rank #${item.market_cap_rank || '?'}`,
          source: 'CoinGecko Trending',
          time_ago: 'now',
          topic: item.symbol?.toLowerCase() || 'crypto',
        });
      }
    }

    newsCache = articles;
    newsCacheTime = Date.now();

    return filterByTopic(articles, topic, limit);
  } catch (error) {
    console.error('[News] CoinGecko trending failed:', error.message);
    return getMockNews(topic, limit);
  }
}

function filterByTopic(articles, topic, limit) {
  if (!topic || topic === 'general' || topic === 'crypto') {
    return articles.slice(0, limit);
  }
  const lower = topic.toLowerCase();
  const filtered = articles.filter(
    (a) => a.title.toLowerCase().includes(lower) || a.topic.includes(lower),
  );
  return filtered.length > 0 ? filtered.slice(0, limit) : articles.slice(0, limit);
}

function getMockNews(topic, limit) {
  const mockArticles = [
    { title: 'Solana TVL hits new all-time high as DeFi activity surges', source: 'The Block', time_ago: '1h ago', topic: 'solana' },
    { title: 'Jupiter DEX aggregator processes record daily volume', source: 'CoinDesk', time_ago: '2h ago', topic: 'solana' },
    { title: 'Bitcoin holds above $95K as institutional inflows continue', source: 'Bloomberg', time_ago: '3h ago', topic: 'bitcoin' },
    { title: 'Ethereum layer-2 fees drop to record lows', source: 'Decrypt', time_ago: '4h ago', topic: 'ethereum' },
    { title: 'New memecoin season heats up on Solana', source: 'DL News', time_ago: '5h ago', topic: 'solana' },
    { title: 'Solana Seeker phone ships to first customers', source: 'CoinTelegraph', time_ago: '6h ago', topic: 'solana' },
    { title: 'DeFi lending protocols see surge in borrowing activity', source: 'The Defiant', time_ago: '8h ago', topic: 'defi' },
  ];

  return filterByTopic(mockArticles, topic, limit);
}

module.exports = { getNews };
