const { getMarketData, getPrices } = require('./coingecko');
const { getQuote } = require('./jupiter');
const { getRecentLargeTransfers } = require('./solscan');
const { analyze } = require('./tokenResearch');
const { getNews } = require('./news');
const { parseWalletHoldings } = require('./walletParser');
const { getCached, setCache } = require('../utils/cache');

// Liquid staking token mints
const LIQUID_STAKING_TOKENS = {
  JITOSOL: { mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', name: 'Jito Staked SOL' },
  MSOL: { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', name: 'Marinade Staked SOL' },
  BSOL: { mint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', name: 'BlazeStake SOL' },
  INF: { mint: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm', name: 'Sanctum Infinity' },
};

// Skill registry
const skills = {
  price_check: async ({ token, symbol }) => {
    const t = token || symbol;
    if (!t) throw new Error('token or symbol param required');
    const data = await getMarketData(t);
    return {
      symbol: t.toUpperCase(),
      price: data.price,
      change_24h: data.change_24h,
      volume_24h: data.volume_24h,
      market_cap: data.market_cap,
    };
  },

  portfolio_track: async ({ wallet_content }) => {
    const holdings = parseWalletHoldings(wallet_content);
    if (holdings.length === 0) {
      return { total_value_usd: 0, holdings: [], message: 'No holdings found in wallet' };
    }

    const symbols = holdings.map((h) => h.symbol);
    const prices = await getPrices(symbols);

    const enriched = holdings.map((h) => {
      const priceData = prices[h.symbol];
      const currentPrice = priceData?.price || 0;
      const currentValue = h.amount * currentPrice;
      const pnlPercent = h.avgEntry > 0
        ? ((currentPrice - h.avgEntry) / h.avgEntry) * 100
        : 0;

      return {
        symbol: h.symbol,
        amount: h.amount,
        avg_entry: h.avgEntry,
        current_price: currentPrice,
        current_value: currentValue,
        pnl_percent: pnlPercent,
        change_24h: priceData?.change_24h || 0,
      };
    });

    const totalValue = enriched.reduce((sum, h) => sum + h.current_value, 0);

    return {
      total_value_usd: totalValue,
      holdings: enriched,
      last_updated: new Date().toISOString(),
    };
  },

  swap_quote: async ({ from, to, amount }) => {
    if (!from) throw new Error('from token param required');
    if (!to) throw new Error('to token param required');
    if (!amount || isNaN(parseFloat(amount))) throw new Error('valid amount param required');
    const quote = await getQuote(from, to, parseFloat(amount));
    return {
      from: { symbol: from.toUpperCase(), amount: quote.inAmount },
      to: { symbol: to.toUpperCase(), amount: quote.outAmount },
      rate: quote.rate,
      price_impact: quote.priceImpact,
      min_received: quote.minReceived,
      slippage: quote.slippage,
      route: quote.route,
      execution_available: false,
      source: quote.source || 'jupiter',
    };
  },

  whale_watch: async ({ token }) => {
    const activity = await getRecentLargeTransfers(token);
    return {
      token: token.toUpperCase(),
      large_transactions: activity.recent_large_txs,
      whale_sentiment: activity.whale_holdings_change_24h,
      summary: activity.notable,
      source: activity.source,
    };
  },

  token_research: async ({ token, symbol }) => {
    const t = token || symbol;
    if (!t) throw new Error('token or symbol param required');

    // Try DexScreener-based research for richer data
    try {
      const DEXSCREENER_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens';
      const DEXSCREENER_SEARCH = 'https://api.dexscreener.com/latest/dex/search';
      const { MINT_MAP } = require('./jupiter');

      let address = t;
      if (t.length < 20) {
        const sym = t.toUpperCase();
        if (MINT_MAP[sym]) {
          address = MINT_MAP[sym];
        } else {
          const searchRes = await fetch(`${DEXSCREENER_SEARCH}?q=${encodeURIComponent(t)}`, {
            signal: AbortSignal.timeout(8000),
          });
          if (searchRes.ok) {
            const searchJson = await searchRes.json();
            const solanaPair = (searchJson.pairs || []).find(p =>
              p.chainId === 'solana' && p.baseToken?.symbol?.toUpperCase() === sym
            );
            if (solanaPair) address = solanaPair.baseToken.address;
          }
        }
      }

      const pairRes = await fetch(`${DEXSCREENER_TOKENS}/${address}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (pairRes.ok) {
        const pairJson = await pairRes.json();
        const solanaPairs = (pairJson.pairs || []).filter(p => p.chainId === 'solana');
        if (solanaPairs.length > 0) {
          solanaPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
          const pair = solanaPairs[0];
          const base = pair.baseToken || {};
          const liq = pair.liquidity?.usd || 0;
          const vol = pair.volume?.h24 || 0;
          const txns = pair.txns?.h24 || {};
          const change = pair.priceChange || {};

          let score = 5;
          const flags = [];
          if (liq > 1000000) score += 2;
          else if (liq > 100000) score += 1;
          else { score -= 2; flags.push('LOW_LIQUIDITY'); }
          if (vol > 1000000) score += 1;
          if (pair.pairCreatedAt) {
            const ageDays = (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24);
            if (ageDays < 7) { score -= 2; flags.push('NEW_TOKEN'); }
            else if (ageDays > 30) score += 1;
          }
          if (txns.sells > 0 && (txns.buys / txns.sells) < 0.5) {
            score -= 1; flags.push('HIGH_SELL_PRESSURE');
          }
          score = Math.max(1, Math.min(10, score));

          return {
            token: {
              name: base.name || t,
              symbol: base.symbol || t.toUpperCase(),
              address: base.address || address,
              price: parseFloat(pair.priceUsd) || 0,
              priceChange5m: change.m5 || 0,
              priceChange1h: change.h1 || 0,
              priceChange6h: change.h6 || 0,
              priceChange24h: change.h24 || 0,
              volume24h: vol,
              liquidity: liq,
              marketCap: pair.marketCap || pair.fdv || 0,
              txns24h: { buys: txns.buys || 0, sells: txns.sells || 0 },
              safetyScore: score,
              flags,
              dexscreenerUrl: pair.url || `https://dexscreener.com/solana/${pair.pairAddress || ''}`,
            },
          };
        }
      }
    } catch (err) {
      console.warn('[Skills] DexScreener research fallback:', err.message);
    }

    // Fallback to CoinGecko analysis
    const info = await analyze(t);
    return {
      symbol: info.symbol,
      name: info.name,
      price: info.price,
      market_cap: info.marketCap,
      volume_24h: info.volume,
      safety_score: info.safetyScore,
      safety_flags: info.flags,
      on_jupiter_strict: info.onStrictList,
      verdict: info.verdict,
    };
  },

  price_alert: async ({ token, condition, price }) => {
    return {
      action: 'create_alert',
      alert: {
        token: token.toUpperCase(),
        condition: condition || 'above',
        target_price: parseFloat(price),
      },
      message: `Alert set: Notify when ${token.toUpperCase()} goes ${condition || 'above'} $${price}`,
    };
  },

  dca_setup: async ({ from, to, amount, interval }) => {
    const intervalHours = parseInt(interval) || 24;
    return {
      action: 'create_dca',
      from_token: (from || 'USDC').toUpperCase(),
      to_token: (to || 'SOL').toUpperCase(),
      amount: parseFloat(amount) || 10,
      interval_hours: intervalHours,
      message: `DCA configured: Buy ${amount} ${(from || 'USDC').toUpperCase()} worth of ${(to || 'SOL').toUpperCase()} every ${intervalHours}h`,
    };
  },

  news_digest: async ({ topic }) => {
    const articles = await getNews(topic || 'crypto', 5);
    return {
      topic: topic || 'general',
      articles: articles.map((a) => ({
        title: a.title,
        source: a.source,
        time: a.time_ago,
      })),
    };
  },

  limit_buy: async ({ token, price, amount, base, expires }) => {
    const t = (token || '').toUpperCase();
    if (!t || !price || !amount) throw new Error('token, price, and amount params required');
    return {
      action: 'create_order',
      order: {
        type: 'limit_buy',
        token: t,
        trigger_price: parseFloat(price),
        amount: parseFloat(amount),
        base_token: (base || 'USDC').toUpperCase(),
        expires_hours: expires ? parseInt(expires) : null,
      },
      message: `Limit buy set: Buy ${amount} ${(base || 'USDC').toUpperCase()} worth of ${t} when price drops to $${price}`,
    };
  },

  limit_sell: async ({ token, price, amount, base, expires }) => {
    const t = (token || '').toUpperCase();
    if (!t || !price || !amount) throw new Error('token, price, and amount params required');
    return {
      action: 'create_order',
      order: {
        type: 'limit_sell',
        token: t,
        trigger_price: parseFloat(price),
        amount: parseFloat(amount),
        base_token: (base || 'USDC').toUpperCase(),
        expires_hours: expires ? parseInt(expires) : null,
      },
      message: `Limit sell set: Sell ${amount} ${t} when price rises to $${price}`,
    };
  },

  stop_loss: async ({ token, price, amount, base, expires }) => {
    const t = (token || '').toUpperCase();
    if (!t || !price || !amount) throw new Error('token, price, and amount params required');
    return {
      action: 'create_order',
      order: {
        type: 'stop_loss',
        token: t,
        trigger_price: parseFloat(price),
        amount: parseFloat(amount),
        base_token: (base || 'USDC').toUpperCase(),
        expires_hours: expires ? parseInt(expires) : null,
      },
      message: `Stop loss set: Sell ${amount} ${t} if price drops to $${price}`,
    };
  },

  view_orders: async () => {
    return {
      action: 'view_orders',
      message: 'Fetching your active orders...',
    };
  },

  cancel_order: async ({ order_id }) => {
    if (!order_id) throw new Error('order_id param required');
    return {
      action: 'cancel_order',
      order_id,
      message: `Cancelling order ${order_id}...`,
    };
  },

  defi_yields: async ({ token, sort, limit }) => {
    try {
      const cacheKey = `defi_yields_${token || 'all'}_${sort || 'apy'}`;
      const cached = getCached(cacheKey, 5 * 60 * 1000);
      if (cached) return cached;

      const url = `https://yields.llama.fi/pools`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`);

      const json = await res.json();
      let pools = (json.data || []).filter(p =>
        p.chain === 'Solana' && p.tvlUsd > 100000 && p.apy != null
      );

      if (token) {
        const t = token.toLowerCase();
        pools = pools.filter(p => (p.symbol || '').toLowerCase().includes(t));
      }

      if (sort === 'tvl') {
        pools.sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0));
      } else {
        pools.sort((a, b) => (b.apy || 0) - (a.apy || 0));
      }

      pools = pools.slice(0, parseInt(limit) || 5);

      const LIQUID_SYMS = ['msol', 'jitosol', 'bsol', 'inf'];
      const LENDING_PROJECTS = ['solend', 'marginfi', 'kamino', 'drift', 'save'];
      const STABLES = ['usdc', 'usdt', 'dai'];

      const result = {
        pools: pools.map(p => {
          const sym = (p.symbol || '').toLowerCase();
          const proj = (p.project || '').toLowerCase();
          let category = 'other', difficulty = 'medium', action = 'external';

          if (p.exposure === 'single' && LIQUID_SYMS.some(s => sym.includes(s))) {
            category = 'liquid_staking'; difficulty = 'easy'; action = 'swap';
          } else if (LENDING_PROJECTS.some(lp => proj.includes(lp)) && p.exposure === 'single') {
            category = 'lending'; difficulty = 'advanced';
          } else if (p.exposure === 'multi') {
            const tokens = sym.split('-');
            const allStable = tokens.every(t => STABLES.some(s => t.includes(s)));
            category = allStable ? 'lp_stable' : 'lp_volatile';
          } else if (p.exposure === 'single') {
            category = 'staking'; difficulty = 'easy';
          }

          return {
            project: p.project,
            symbol: p.symbol,
            tvlUsd: p.tvlUsd,
            apy: p.apy,
            apyBase: p.apyBase,
            apyReward: p.apyReward,
            rewardTokens: p.rewardTokens || [],
            exposure: p.exposure,
            il7d: p.il7d,
            category,
            difficulty,
            action,
          };
        }),
      };

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.error('[Skills] defi_yields error:', err.message);
      throw new Error('Failed to fetch DeFi yields');
    }
  },

  trending_tokens: async ({ limit }) => {
    try {
      const cacheKey = 'trending_tokens_skill';
      const cached = getCached(cacheKey, 60000);
      if (cached) return cached;

      const boostRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
        signal: AbortSignal.timeout(10000),
      });
      if (!boostRes.ok) throw new Error(`DexScreener error: ${boostRes.status}`);

      const boosts = await boostRes.json();
      const solanaTokens = (boosts || []).filter(t => t.chainId === 'solana').slice(0, 15);
      const addresses = solanaTokens.map(t => t.tokenAddress).filter(Boolean);

      let pairData = {};
      if (addresses.length > 0) {
        try {
          const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`, {
            signal: AbortSignal.timeout(10000),
          });
          if (pairRes.ok) {
            const pairJson = await pairRes.json();
            for (const pair of (pairJson.pairs || [])) {
              if (pair.chainId !== 'solana') continue;
              const addr = pair.baseToken?.address;
              if (!addr) continue;
              if (!pairData[addr] || (pair.liquidity?.usd || 0) > (pairData[addr].liquidity?.usd || 0)) {
                pairData[addr] = pair;
              }
            }
          }
        } catch (_) {}
      }

      const tokens = [];
      for (const boost of solanaTokens) {
        const pair = pairData[boost.tokenAddress];
        if (!pair) continue;
        const base = pair.baseToken || {};
        const liq = pair.liquidity?.usd || 0;
        if (liq < 10000) continue;

        const vol = pair.volume?.h24 || 0;
        const buys = pair.txns?.h24?.buys || 0;
        const sells = pair.txns?.h24?.sells || 0;
        const change24h = pair.priceChange?.h24 || 0;

        let safetyScore = 5;
        const flags = [];
        if (liq > 1000000) safetyScore += 2;
        else if (liq > 100000) safetyScore += 1;
        else { safetyScore -= 2; flags.push('LOW_LIQUIDITY'); }
        if (vol > 1000000) safetyScore += 1;
        if (pair.pairCreatedAt) {
          const ageDays = (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24);
          if (ageDays < 7) { safetyScore -= 2; flags.push('NEW_TOKEN'); }
          else if (ageDays > 30) safetyScore += 1;
        }
        if (sells > 0 && buys / sells < 0.5) { safetyScore -= 1; flags.push('HIGH_SELL_PRESSURE'); }
        safetyScore = Math.max(1, Math.min(10, safetyScore));

        tokens.push({
          name: base.name || 'Unknown',
          symbol: base.symbol || '???',
          address: base.address || '',
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: change24h,
          volume24h: vol,
          liquidity: liq,
          marketCap: pair.marketCap || pair.fdv || 0,
          txns24h: { buys, sells },
          safetyScore,
          flags,
        });
      }

      tokens.sort((a, b) => b.volume24h - a.volume24h);
      const result = { tokens: tokens.slice(0, parseInt(limit) || 5) };

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.error('[Skills] trending_tokens error:', err.message);
      throw new Error('Failed to fetch trending tokens');
    }
  },

  park_digest: async ({ park_context }) => {
    if (!park_context || park_context.trim().length === 0) {
      return { summary: 'Agent Park is quiet right now. No recent messages.', messages_count: 0 };
    }
    const lines = park_context.split('\n').filter(l => l.trim());
    const tokenMentions = {};
    const tokenRegex = /\b(SOL|WIF|BONK|JUP|RNDR|PYTH|JTO|JITOSOL|MSOL|BSOL|RAY|ORCA|HNT|WEN|POPCAT)\b/gi;
    for (const line of lines) {
      const matches = line.match(tokenRegex) || [];
      for (const m of matches) {
        const sym = m.toUpperCase();
        tokenMentions[sym] = (tokenMentions[sym] || 0) + 1;
      }
    }
    const hotTopics = Object.entries(tokenMentions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sym, count]) => ({ symbol: sym, mentions: count }));
    return {
      messages_count: lines.length,
      hot_topics: hotTopics,
      raw_context: park_context,
    };
  },

  park_consensus: async ({ token, park_context }) => {
    const t = (token || '').toUpperCase();
    if (!t) throw new Error('token param required');
    if (!park_context || park_context.trim().length === 0) {
      return { token: t, consensus: 'No agent discussions found about ' + t, messages: 0 };
    }
    const lines = park_context.split('\n').filter(l => l.trim());
    const relevant = lines.filter(l => l.toUpperCase().includes(t));
    return {
      token: t,
      relevant_messages: relevant.length,
      total_messages: lines.length,
      context: relevant.join('\n') || 'No messages mention ' + t,
    };
  },

  park_post: async ({ content, park_mode }) => {
    if (park_mode !== 'active') {
      return {
        action: 'park_post_blocked',
        message: 'Park mode is set to Listen. Switch to Active in Settings to post to Agent Park.',
      };
    }
    return {
      action: 'park_post',
      content: content || '',
      message: 'Ready to post to Agent Park.',
    };
  },

  // === NEW SKILLS: Advanced ===

  new_tokens: async ({ limit, min_liquidity }) => {
    try {
      const cacheKey = `new_tokens_skill_${limit || 5}`;
      const cached = getCached(cacheKey, 60000);
      if (cached) return cached;

      const latestRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
        signal: AbortSignal.timeout(10000),
      });
      if (!latestRes.ok) throw new Error(`DexScreener error: ${latestRes.status}`);

      const profiles = await latestRes.json();
      const solanaTokens = (profiles || []).filter(t => t.chainId === 'solana').slice(0, 20);
      const addresses = solanaTokens.map(t => t.tokenAddress).filter(Boolean);

      let pairData = {};
      if (addresses.length > 0) {
        try {
          const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.slice(0, 20).join(',')}`, {
            signal: AbortSignal.timeout(10000),
          });
          if (pairRes.ok) {
            const pairJson = await pairRes.json();
            for (const pair of (pairJson.pairs || [])) {
              if (pair.chainId !== 'solana') continue;
              const addr = pair.baseToken?.address;
              if (!addr) continue;
              if (!pairData[addr] || (pair.liquidity?.usd || 0) > (pairData[addr].liquidity?.usd || 0)) {
                pairData[addr] = pair;
              }
            }
          }
        } catch (_) {}
      }

      const tokens = [];
      const minLiq = parseInt(min_liquidity) || 10000;
      for (const profile of solanaTokens) {
        const pair = pairData[profile.tokenAddress];
        if (!pair) continue;
        const base = pair.baseToken || {};
        const liq = pair.liquidity?.usd || 0;
        if (liq < minLiq) continue;

        const vol = pair.volume?.h24 || 0;
        const change24h = pair.priceChange?.h24 || 0;
        let ageHours = null;
        if (pair.pairCreatedAt) {
          ageHours = Math.round((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60));
        }

        let safetyScore = 5;
        const flags = [];
        if (liq > 1000000) safetyScore += 2;
        else if (liq > 100000) safetyScore += 1;
        else { safetyScore -= 2; flags.push('LOW_LIQUIDITY'); }
        if (vol > 1000000) safetyScore += 1;
        if (ageHours !== null && ageHours < 168) { safetyScore -= 2; flags.push('NEW_TOKEN'); }
        safetyScore = Math.max(1, Math.min(10, safetyScore));

        tokens.push({
          name: base.name || 'Unknown',
          symbol: base.symbol || '???',
          address: base.address || '',
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: change24h,
          volume24h: vol,
          liquidity: liq,
          marketCap: pair.marketCap || pair.fdv || 0,
          ageHours,
          safetyScore,
          flags,
          dexscreenerUrl: pair.url || '',
        });
      }

      tokens.sort((a, b) => (a.ageHours || 9999) - (b.ageHours || 9999));
      const result = { tokens: tokens.slice(0, parseInt(limit) || 5) };
      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.error('[Skills] new_tokens error:', err.message);
      throw new Error('Failed to fetch new tokens');
    }
  },

  view_alerts: async () => {
    return {
      action: 'view_alerts',
      message: 'Fetching your active price alerts...',
    };
  },

  cancel_alert: async ({ alert_id }) => {
    if (!alert_id) throw new Error('alert_id param required');
    return {
      action: 'cancel_alert',
      alert_id,
      message: `Cancelling alert ${alert_id}...`,
    };
  },

  send_token: async ({ to, amount, token }) => {
    const t = (token || 'SOL').toUpperCase();
    if (!to) throw new Error('to (recipient address) param required');
    if (!amount) throw new Error('amount param required');

    let resolvedTo = to;
    let osDomain = null;

    // Resolve .os domain to wallet address
    if (to.endsWith('.os') || (to.length < 30 && !to.includes('.'))) {
      const domainName = to.replace(/\.os$/i, '').toLowerCase();
      const serverUrl = `http://localhost:${process.env.PORT || 3000}`;
      try {
        const res = await fetch(`${serverUrl}/api/domains/lookup/${encodeURIComponent(domainName)}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.wallet) {
            resolvedTo = data.wallet;
            osDomain = data.domain;
          }
        }
      } catch {}
    }

    return {
      action: 'send_token',
      send: {
        to: resolvedTo,
        amount: parseFloat(amount),
        token: t,
        osDomain,
      },
      message: osDomain
        ? `Ready to send ${amount} ${t} to ${osDomain} (${resolvedTo.slice(0, 8)}...)`
        : `Ready to send ${amount} ${t} to ${resolvedTo.slice(0, 8)}...`,
    };
  },

  sell_token: async ({ token, amount, to_token }) => {
    const t = (token || '').toUpperCase();
    if (!t) throw new Error('token param required');
    if (!amount) throw new Error('amount param required');
    const target = (to_token || 'USDC').toUpperCase();

    // Get a swap quote
    const quote = await getQuote(t, target, parseFloat(amount));
    return {
      action: 'sell_token',
      from: { symbol: t, amount: parseFloat(amount) },
      to: { symbol: target, amount: quote.outAmount },
      rate: quote.rate,
      price_impact: quote.priceImpact,
      min_received: quote.minReceived,
      slippage: quote.slippage,
      route: quote.route,
      source: quote.source,
      rawQuote: quote.rawResponse,
      message: `Sell ${amount} ${t} → ${quote.outAmount.toFixed(2)} ${target}`,
    };
  },

  rotate_token: async ({ from_token, to_token, amount }) => {
    const from = (from_token || '').toUpperCase();
    const to = (to_token || '').toUpperCase();
    if (!from || !to) throw new Error('from_token and to_token params required');
    if (!amount) throw new Error('amount param required');

    const quote = await getQuote(from, to, parseFloat(amount));
    return {
      action: 'rotate_token',
      from: { symbol: from, amount: parseFloat(amount) },
      to: { symbol: to, amount: quote.outAmount },
      rate: quote.rate,
      price_impact: quote.priceImpact,
      min_received: quote.minReceived,
      slippage: quote.slippage,
      route: quote.route,
      source: quote.source,
      rawQuote: quote.rawResponse,
      message: `Rotate ${amount} ${from} → ${quote.outAmount.toFixed(6)} ${to}`,
    };
  },

  go_stablecoin: async ({ token, amount }) => {
    const t = (token || 'SOL').toUpperCase();
    if (!amount) throw new Error('amount param required');

    const quote = await getQuote(t, 'USDC', parseFloat(amount));
    return {
      action: 'go_stablecoin',
      from: { symbol: t, amount: parseFloat(amount) },
      to: { symbol: 'USDC', amount: quote.outAmount },
      rate: quote.rate,
      price_impact: quote.priceImpact,
      min_received: quote.minReceived,
      slippage: quote.slippage,
      route: quote.route,
      source: quote.source,
      rawQuote: quote.rawResponse,
      message: `Emergency exit: ${amount} ${t} → ${quote.outAmount.toFixed(2)} USDC`,
    };
  },

  whale_track: async ({ wallet, label }) => {
    if (!wallet) throw new Error('wallet address param required');
    return {
      action: 'whale_track',
      wallet,
      label: label || `Whale ${wallet.slice(0, 6)}`,
      message: `Now tracking wallet ${wallet.slice(0, 8)}...`,
    };
  },

  whale_activity: async ({ wallet, label }) => {
    if (!wallet) throw new Error('wallet address param required');

    // Mock activity data
    const now = Date.now();
    const transactions = [
      {
        type: 'SWAP',
        description: `Swapped SOL for USDC ($${(Math.random() * 50000 + 5000).toFixed(0)})`,
        timestamp: now - 3600000,
      },
      {
        type: 'SWAP',
        description: `Bought WIF with ${(Math.random() * 100 + 10).toFixed(0)} SOL`,
        timestamp: now - 7200000,
      },
      {
        type: 'TRANSFER',
        description: `Received ${(Math.random() * 500 + 100).toFixed(0)} SOL`,
        timestamp: now - 14400000,
      },
    ];

    return {
      wallet,
      label: label || `Whale ${wallet.slice(0, 6)}`,
      transactions,
      source: 'mock',
    };
  },

  whale_stop: async ({ wallet }) => {
    if (!wallet) throw new Error('wallet address param required');
    return {
      action: 'whale_stop',
      wallet,
      message: `Stopped tracking wallet ${wallet.slice(0, 8)}...`,
    };
  },

  claim_domain: async ({ name }) => {
    if (!name) throw new Error('name param required (e.g. "degen")');
    const { checkDomain, getPrice: getDomainPrice, DOMAIN_PRICING, getTier } = require('../config/domains');
    const { getPrice: getSOLPrice } = require('./coingecko');

    const cleanName = name.replace(/\.os$/i, '').toLowerCase().trim();
    const { validateName } = require('../config/domains');
    const validation = validateName(cleanName);
    if (!validation.valid) {
      return { action: 'claim_error', error: validation.error };
    }

    const tier = getTier(cleanName);
    const price = getDomainPrice(cleanName);
    const domain = `${cleanName}.os`;

    // Check availability via server route helper
    const serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    try {
      const res = await fetch(`${serverUrl}/api/domains/check/${encodeURIComponent(cleanName)}`, {
        signal: AbortSignal.timeout(5000),
      });
      const checkResult = await res.json();

      if (!checkResult.available) {
        if (checkResult.owner) {
          return { action: 'claim_unavailable', name: cleanName, domain, available: false, message: 'This domain is already taken.' };
        }
      }
    } catch {
      // Server check failed, provide price info anyway
    }

    // Get USD price
    let priceUsd = null;
    try {
      const solData = await getSOLPrice('sol');
      priceUsd = price * (solData?.price || 90);
    } catch {
      priceUsd = price * 90;
    }

    return {
      action: 'claim_domain',
      name: cleanName,
      domain,
      tier,
      price,
      priceUsd: Math.round(priceUsd * 100) / 100,
      available: true,
      tierInfo: DOMAIN_PRICING[tier],
    };
  },

  lookup_domain: async ({ domain, name }) => {
    const input = domain || name || '';
    let cleanDomain = input.trim();
    if (!cleanDomain.endsWith('.os')) cleanDomain += '.os';
    const cleanName = cleanDomain.replace('.os', '').toLowerCase();

    const serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    try {
      const res = await fetch(`${serverUrl}/api/domains/lookup/${encodeURIComponent(cleanName)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return { action: 'lookup_not_found', domain: cleanDomain, error: `${cleanDomain} is not registered.` };
      }
      const data = await res.json();
      const { getTier } = require('../config/domains');
      return {
        action: 'lookup_result',
        domain: data.domain,
        wallet: data.wallet,
        tier: data.agent?.tier || getTier(cleanName),
        agent: data.agent,
      };
    } catch (err) {
      return { action: 'lookup_error', domain: cleanDomain, error: err.message };
    }
  },

  // === MEMORY SKILLS ===

  my_memory: async ({ wallet_address, category }) => {
    if (!wallet_address) {
      return { memories: [], total: 0, message: 'No wallet connected — cannot access persistent memory.' };
    }
    const { getAgentMemory, getMemoryCount } = require('./memory');
    const memories = getAgentMemory(wallet_address, category || null);
    const count = getMemoryCount(wallet_address);

    // Group by category
    const grouped = {};
    for (const mem of memories) {
      if (!grouped[mem.category]) grouped[mem.category] = [];
      grouped[mem.category].push({
        id: mem.id,
        content: mem.content,
        confidence: mem.confidence,
        source: mem.source,
        created_at: mem.created_at,
      });
    }

    return {
      action: 'show_memory',
      memories: grouped,
      total: count,
      categories: Object.keys(grouped),
    };
  },

  remember_this: async ({ fact, wallet_address, category }) => {
    if (!wallet_address) {
      return { action: 'remember_error', error: 'No wallet connected — cannot save to persistent memory.' };
    }
    if (!fact) throw new Error('fact param required (e.g. "user prefers low-risk DeFi")');

    const { saveMemoryFact, CATEGORIES } = require('./memory');
    const cat = CATEGORIES.includes(category) ? category : 'general';
    const result = saveMemoryFact(wallet_address, fact, cat, 'user_explicit', 1.0);

    if (result.success) {
      return {
        action: 'memory_saved',
        fact,
        category: cat,
        message: `Saved to my brain: "${fact}"`,
      };
    }
    return { action: 'memory_error', error: result.error || 'Failed to save memory' };
  },

  forget_this: async ({ search, wallet_address }) => {
    if (!wallet_address) {
      return { action: 'forget_error', error: 'No wallet connected.' };
    }
    if (!search) throw new Error('search param required (e.g. "risk tolerance")');

    const { forgetMemoryByContent } = require('./memory');
    const result = forgetMemoryByContent(wallet_address, search);

    return {
      action: 'memory_forgotten',
      search_term: search,
      deleted_count: result.deleted || 0,
      message: result.deleted > 0
        ? `Forgot ${result.deleted} memory(s) matching "${search}"`
        : `No memories found matching "${search}"`,
    };
  },

  daily_recap: async ({ wallet_address }) => {
    if (!wallet_address) {
      return { action: 'recap_error', error: 'No wallet connected.' };
    }

    const { generateDailySummary, getTodayLog } = require('./memory');
    const events = getTodayLog(wallet_address);
    const summary = await generateDailySummary(wallet_address);

    return {
      action: 'daily_recap',
      date: new Date().toISOString().split('T')[0],
      events_count: events.length,
      events: events.slice(-20).map((e) => ({
        type: e.event_type,
        content: e.content,
        time: e.created_at,
      })),
      summary: summary.summary,
    };
  },

  weekly_recap: async ({ wallet_address }) => {
    if (!wallet_address) {
      return { action: 'recap_error', error: 'No wallet connected.' };
    }

    const { generateWeeklyRecap } = require('./memory');
    const recap = await generateWeeklyRecap(wallet_address);

    return {
      action: 'weekly_recap',
      recap: recap.recap,
      days_active: recap.days,
      total_events: recap.total_events || 0,
    };
  },

  liquid_stake: async ({ token, amount }) => {
    const tokenKey = (token || 'JITOSOL').toUpperCase();
    const lstInfo = LIQUID_STAKING_TOKENS[tokenKey] || LIQUID_STAKING_TOKENS.JITOSOL;
    const stakeAmount = parseFloat(amount) || 1.0;

    // Get a quote from Jupiter
    const quote = await getQuote('SOL', tokenKey === 'MSOL' ? 'MSOL' : (tokenKey === 'BSOL' ? 'BSOL' : 'JITO'), stakeAmount);

    // Also try to get APY from DeFiLlama
    let apy = null;
    try {
      const cached = getCached('lst_apys', 5 * 60 * 1000);
      if (cached) {
        apy = cached[tokenKey];
      } else {
        const res = await fetch('https://yields.llama.fi/pools', { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const json = await res.json();
          const solPools = (json.data || []).filter(p => p.chain === 'Solana');
          const apys = {};
          for (const p of solPools) {
            const sym = (p.symbol || '').toLowerCase();
            if (sym.includes('jitosol') && !apys.JITOSOL) apys.JITOSOL = p.apy;
            if (sym === 'msol' && !apys.MSOL) apys.MSOL = p.apy;
            if (sym === 'bsol' && !apys.BSOL) apys.BSOL = p.apy;
            if (sym === 'inf' && !apys.INF) apys.INF = p.apy;
          }
          setCache('lst_apys', apys);
          apy = apys[tokenKey];
        }
      }
    } catch (_) {}

    return {
      action: 'liquid_stake',
      token: tokenKey,
      token_name: lstInfo.name,
      mint: lstInfo.mint,
      amount: stakeAmount,
      apy: apy,
      quote: {
        from: { symbol: 'SOL', amount: quote.inAmount },
        to: { symbol: tokenKey, amount: quote.outAmount },
        rate: quote.rate,
        price_impact: quote.priceImpact,
        min_received: quote.minReceived,
        slippage: quote.slippage,
        route: quote.route,
        source: quote.source,
      },
      message: `Stake ${stakeAmount} SOL → ${lstInfo.name}${apy ? ` (${apy.toFixed(1)}% APY)` : ''}`,
    };
  },
};

/**
 * Parse skill tags from AI response.
 * Format: [SKILL:skill_name:param1=value1,param2=value2]
 */
function parseSkillTags(text) {
  const tags = [];
  const regex = /\[SKILL:(\w+)(?::([^\]]*))?\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const skillName = match[1];
    const paramsStr = match[2] || '';
    const params = {};

    if (paramsStr) {
      for (const pair of paramsStr.split(',')) {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key.trim()] = value.trim();
        }
      }
    }

    tags.push({ skill: skillName, params });
  }

  return tags;
}

/**
 * Remove skill tags from text to get clean response.
 */
function cleanSkillTags(text) {
  return text.replace(/\[SKILL:\w+(?::[^\]]*)?]/g, '').trim();
}

/**
 * Execute a skill by name.
 */
async function executeSkill(skillName, params) {
  const handler = skills[skillName];
  if (!handler) {
    return { skill: skillName, success: false, error: `Unknown skill: ${skillName}` };
  }

  try {
    const data = await handler(params);
    return { skill: skillName, success: true, data };
  } catch (err) {
    console.error(`[Skills] ${skillName} failed:`, err.message);
    return { skill: skillName, success: false, error: err.message };
  }
}

module.exports = { executeSkill, parseSkillTags, cleanSkillTags };
