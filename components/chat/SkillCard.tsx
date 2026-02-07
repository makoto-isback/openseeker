import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { TransactionCard } from './TransactionCard';
import { executeSwap, type SwapResult } from '../../services/swap';
import { OrderCreatedCard, ViewOrdersCard, CancelOrderCard } from './OrderCard';
import { DefiYieldCard } from './DefiYieldCard';
import { TrendingTokensCard } from './TrendingTokensCard';
import { TokenResearchCard } from './TokenResearchCard';
import { SendConfirmCard } from './SendConfirmCard';
import { SellConfirmCard } from './SellConfirmCard';
import { WhaleTrackCard } from './WhaleTrackCard';
import { NewTokensCard } from './NewTokensCard';
import { DomainClaimCard } from './DomainClaimCard';
import { MemoryCard } from './MemoryCard';

interface SkillCardProps {
  skill: string;
  success: boolean;
  data?: any;
  error?: string;
}

export function SkillCard({ skill, success, data, error }: SkillCardProps) {
  if (!success) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.errorText}>Skill failed: {error}</Text>
      </View>
    );
  }

  switch (skill) {
    case 'price_check':
      return <PriceCard data={data} />;
    case 'portfolio_track':
      return <PortfolioCard data={data} />;
    case 'swap_quote':
      return <SwapCard data={data} />;
    case 'whale_watch':
      return <WhaleCard data={data} />;
    case 'price_alert':
      return <AlertCard data={data} />;
    case 'dca_setup':
      return <DCACard data={data} />;
    case 'limit_buy':
    case 'limit_sell':
    case 'stop_loss':
      return <OrderCreatedCard data={data} />;
    case 'view_orders':
      return <ViewOrdersCard orders={data?.orders || []} />;
    case 'cancel_order':
      return <CancelOrderCard data={data} />;
    case 'defi_yields':
      return <DefiYieldCard data={data} />;
    case 'trending_tokens':
      return <TrendingTokensCard data={data} />;
    case 'token_research':
      return data?.token ? <TokenResearchCard data={data} /> : <ResearchCard data={data} />;
    case 'liquid_stake':
      return <LiquidStakeCard data={data} />;
    case 'new_tokens':
      return <NewTokensCard data={data} />;
    case 'view_alerts':
      return <ViewAlertsCard data={data} />;
    case 'cancel_alert':
      return <AlertCard data={data} />;
    case 'send_token':
      return <SendConfirmCard data={data} />;
    case 'sell_token':
    case 'rotate_token':
    case 'go_stablecoin':
      return <SellConfirmCard data={data} />;
    case 'whale_track':
      return <WhaleTrackCard data={data} type="track" />;
    case 'whale_activity':
      return <WhaleTrackCard data={data} type="activity" />;
    case 'whale_stop':
      return <WhaleTrackCard data={data} type="stop" />;
    case 'news_digest':
      return <NewsDigestCard data={data} />;
    case 'park_digest':
      return <ParkDigestCard data={data} />;
    case 'park_consensus':
      return <ParkConsensusCard data={data} />;
    case 'park_post':
      return <ParkPostCard data={data} />;
    case 'claim_domain':
      return <DomainClaimCard data={data} skill="claim_domain" />;
    case 'lookup_domain':
      return <DomainClaimCard data={data} skill="lookup_domain" />;
    case 'my_memory':
    case 'remember_this':
    case 'forget_this':
    case 'daily_recap':
    case 'weekly_recap':
      return <MemoryCard data={data} skill={skill} />;
    default:
      return null;
  }
}

function PriceCard({ data }: { data: any }) {
  const isPositive = data.change_24h >= 0;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{data.symbol}</Text>
        <Text style={styles.cardBadge}>PRICE</Text>
      </View>
      <Text style={styles.priceText}>${formatNum(data.price)}</Text>
      <Text style={[styles.changeText, isPositive ? styles.green : styles.red]}>
        {isPositive ? '+' : ''}{data.change_24h?.toFixed(2)}% (24h)
      </Text>
      {data.volume_24h > 0 && (
        <Text style={styles.metaText}>Vol: ${formatCompact(data.volume_24h)}</Text>
      )}
      {data.market_cap > 0 && (
        <Text style={styles.metaText}>MCap: ${formatCompact(data.market_cap)}</Text>
      )}
    </View>
  );
}

function PortfolioCard({ data }: { data: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Portfolio</Text>
        <Text style={styles.cardBadge}>TRACK</Text>
      </View>
      <Text style={styles.priceText}>${formatNum(data.total_value_usd)}</Text>
      {data.holdings?.map((h: any, i: number) => (
        <View key={i} style={styles.holdingRow}>
          <Text style={styles.holdingSymbol}>{h.symbol}</Text>
          <Text style={styles.holdingAmount}>{h.amount}</Text>
          <Text style={styles.holdingPrice}>${formatNum(h.current_price)}</Text>
          <Text style={[styles.holdingPnl, h.pnl_percent >= 0 ? styles.green : styles.red]}>
            {h.pnl_percent >= 0 ? '+' : ''}{h.pnl_percent?.toFixed(1)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

function SwapCard({ data }: { data: any }) {
  const [state, setState] = useState<'idle' | 'confirming' | 'cancelled'>('idle');
  const [result, setResult] = useState<SwapResult | null>(null);

  const handleConfirm = async () => {
    setState('confirming');
    try {
      const swapResult = await executeSwap(data);
      setResult(swapResult);
    } catch (err: any) {
      setState('idle');
    }
  };

  if (result) {
    return (
      <TransactionCard
        txSignature={result.txSignature}
        fromSymbol={result.fromSymbol}
        fromAmount={result.fromAmount}
        toSymbol={result.toSymbol}
        toAmount={result.toAmount}
        timestamp={result.timestamp}
        source={result.source}
      />
    );
  }

  if (state === 'cancelled') {
    return (
      <View style={styles.card}>
        <Text style={styles.cancelledText}>Swap cancelled</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Swap Quote</Text>
        <Text style={styles.cardBadge}>JUPITER</Text>
      </View>
      <View style={styles.swapRow}>
        <Text style={styles.swapText}>{data.from?.amount} {data.from?.symbol}</Text>
        <Text style={styles.swapArrow}>→</Text>
        <Text style={styles.swapText}>{formatNum(data.to?.amount)} {data.to?.symbol}</Text>
      </View>
      <Text style={styles.metaText}>Rate: 1 {data.from?.symbol} = {formatNum(data.rate)} {data.to?.symbol}</Text>
      <Text style={styles.metaText}>Impact: {data.price_impact}% | Slippage: {data.slippage}</Text>
      <Text style={styles.metaText}>Route: {data.route}</Text>
      {data.source === 'mock' && <Text style={styles.mockText}>Simulated quote</Text>}

      {state === 'confirming' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingText}>Executing swap...</Text>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm Swap</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setState('cancelled')}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function WhaleCard({ data }: { data: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{data.token} Whales</Text>
        <Text style={styles.cardBadge}>WHALE</Text>
      </View>
      {data.large_transactions?.slice(0, 3).map((tx: any, i: number) => (
        <View key={i} style={styles.whaleRow}>
          <Text style={[styles.whaleDir, tx.direction === 'sell' ? styles.red : styles.green]}>
            {tx.direction === 'sell' ? '↓' : '↑'}
          </Text>
          <Text style={styles.whaleAmount}>${formatCompact(tx.value_usd)}</Text>
          <Text style={styles.whaleTime}>{tx.time_ago}</Text>
        </View>
      ))}
      <Text style={styles.metaText}>Whale sentiment: {data.whale_sentiment}</Text>
      {data.source === 'mock' && <Text style={styles.mockText}>Simulated data</Text>}
    </View>
  );
}

function ResearchCard({ data }: { data: any }) {
  const scoreColor = data.safety_score >= 7 ? colors.green : data.safety_score >= 4 ? '#FFB800' : colors.red;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{data.symbol} Research</Text>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
          <Text style={styles.scoreText}>{data.safety_score}/10</Text>
        </View>
      </View>
      {data.on_jupiter_strict && <Text style={styles.flagGreen}>Jupiter verified</Text>}
      {data.market_cap > 0 && <Text style={styles.metaText}>MCap: ${formatCompact(data.market_cap)}</Text>}
      {data.volume_24h > 0 && <Text style={styles.metaText}>Vol: ${formatCompact(data.volume_24h)}</Text>}
      {data.safety_flags?.map((flag: string, i: number) => (
        <Text key={i} style={styles.flagRed}>{flag.replace(/_/g, ' ')}</Text>
      ))}
      <Text style={styles.verdictText}>{data.verdict}</Text>
    </View>
  );
}

function AlertCard({ data }: { data: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Alert Set</Text>
        <Text style={styles.cardBadge}>ALERT</Text>
      </View>
      <Text style={styles.alertText}>
        {data.alert?.token} {data.alert?.condition} ${data.alert?.target_price}
      </Text>
    </View>
  );
}

function ViewAlertsCard({ data }: { data: any }) {
  const alerts = data?.alerts || [];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Active Alerts</Text>
        <Text style={styles.cardBadge}>ALERTS</Text>
      </View>
      {alerts.length === 0 ? (
        <Text style={styles.metaText}>No active alerts. Set one with "alert me when SOL goes above $200"</Text>
      ) : (
        alerts.map((a: any, i: number) => (
          <View key={i} style={styles.holdingRow}>
            <Text style={styles.holdingSymbol}>{a.token}</Text>
            <Text style={styles.holdingAmount}>{a.condition}</Text>
            <Text style={styles.holdingPrice}>${a.targetPrice}</Text>
            <Text style={[styles.holdingPnl, { color: colors.textMuted }]}>
              {a.id?.slice(0, 6)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function DCACard({ data }: { data: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>DCA Configured</Text>
        <Text style={styles.cardBadge}>AUTO</Text>
      </View>
      <Text style={styles.dcaText}>
        {data.amount} {data.from_token} → {data.to_token}
      </Text>
      <Text style={styles.metaText}>Every {data.interval_hours}h</Text>
      <Text style={styles.metaText}>{data.message}</Text>
    </View>
  );
}

function LiquidStakeCard({ data }: { data: any }) {
  const [state, setState] = useState<'idle' | 'confirming' | 'cancelled'>('idle');
  const [result, setResult] = useState<SwapResult | null>(null);

  const handleConfirm = async () => {
    setState('confirming');
    try {
      const swapResult = await executeSwap(data.quote);
      setResult(swapResult);
    } catch (err: any) {
      setState('idle');
    }
  };

  if (result) {
    return (
      <TransactionCard
        txSignature={result.txSignature}
        fromSymbol={result.fromSymbol}
        fromAmount={result.fromAmount}
        toSymbol={result.toSymbol}
        toAmount={result.toAmount}
        timestamp={result.timestamp}
        source={result.source}
      />
    );
  }

  if (state === 'cancelled') {
    return (
      <View style={styles.card}>
        <Text style={styles.cancelledText}>Staking cancelled</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderLeftColor: '#00d4aa' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Liquid Stake</Text>
        <Text style={[styles.cardBadge, { color: '#00d4aa' }]}>STAKE</Text>
      </View>
      <View style={styles.swapRow}>
        <Text style={styles.swapText}>{data.quote?.from?.amount} SOL</Text>
        <Text style={styles.swapArrow}>→</Text>
        <Text style={styles.swapText}>{formatNum(data.quote?.to?.amount)} {data.token}</Text>
      </View>
      {data.apy != null && (
        <Text style={[styles.changeText, styles.green]}>~{data.apy.toFixed(1)}% APY</Text>
      )}
      <Text style={styles.metaText}>{data.token_name}</Text>
      <Text style={styles.metaText}>Route: {data.quote?.route}</Text>
      <Text style={styles.metaText}>No lockup — swap back to SOL anytime</Text>
      {data.quote?.source === 'mock' && <Text style={styles.mockText}>Simulated quote</Text>}

      {state === 'confirming' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingText}>Staking SOL...</Text>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm Stake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setState('cancelled')}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function NewsDigestCard({ data }: { data: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>News Digest</Text>
        <Text style={styles.cardBadge}>NEWS</Text>
      </View>
      {data.articles?.map((a: any, i: number) => (
        <View key={i} style={styles.holdingRow}>
          <Text style={[styles.metaText, { flex: 1 }]} numberOfLines={2}>{a.title}</Text>
          <Text style={styles.metaText}>{a.source}</Text>
        </View>
      ))}
      {(!data.articles || data.articles.length === 0) && (
        <Text style={styles.metaText}>No news found for {data.topic || 'crypto'}</Text>
      )}
    </View>
  );
}

function ParkDigestCard({ data }: { data: any }) {
  return (
    <View style={[styles.card, { borderLeftColor: '#9B59B6' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Agent Park</Text>
        <Text style={[styles.cardBadge, { color: '#9B59B6' }]}>PARK</Text>
      </View>
      <Text style={styles.metaText}>{data.messages_count || 0} recent messages</Text>
      {data.hot_topics?.map((t: any, i: number) => (
        <View key={i} style={styles.holdingRow}>
          <Text style={styles.holdingSymbol}>{t.symbol}</Text>
          <Text style={styles.holdingAmount}>{t.mentions} mentions</Text>
        </View>
      ))}
      {data.summary && <Text style={styles.metaText}>{data.summary}</Text>}
    </View>
  );
}

function ParkConsensusCard({ data }: { data: any }) {
  return (
    <View style={[styles.card, { borderLeftColor: '#9B59B6' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{data.token} Consensus</Text>
        <Text style={[styles.cardBadge, { color: '#9B59B6' }]}>PARK</Text>
      </View>
      <Text style={styles.metaText}>
        {data.relevant_messages || 0} of {data.total_messages || 0} messages mention {data.token}
      </Text>
      {data.consensus && <Text style={styles.alertText}>{data.consensus}</Text>}
    </View>
  );
}

function ParkPostCard({ data }: { data: any }) {
  const isBlocked = data.action === 'park_post_blocked';
  return (
    <View style={[styles.card, { borderLeftColor: isBlocked ? colors.red : '#9B59B6' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{isBlocked ? 'Post Blocked' : 'Park Post'}</Text>
        <Text style={[styles.cardBadge, { color: isBlocked ? colors.red : '#9B59B6' }]}>PARK</Text>
      </View>
      <Text style={styles.metaText}>{data.message}</Text>
      {data.content && <Text style={styles.alertText}>"{data.content}"</Text>}
    </View>
  );
}

// Helpers
function formatNum(n: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  errorCard: {
    borderLeftColor: colors.red,
  },
  errorText: {
    color: colors.red,
    fontSize: fontSize.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardBadge: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  priceText: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  changeText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: 2,
  },
  green: {
    color: colors.green,
  },
  red: {
    color: colors.red,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  holdingSymbol: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    width: 50,
  },
  holdingAmount: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    width: 60,
    textAlign: 'right',
  },
  holdingPrice: {
    color: colors.text,
    fontSize: fontSize.sm,
    width: 70,
    textAlign: 'right',
  },
  holdingPnl: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    width: 60,
    textAlign: 'right',
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  swapText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  swapArrow: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.green,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.red,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  cancelledText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontStyle: 'italic',
  },
  mockText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  warningText: {
    color: '#FFB800',
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  whaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  whaleDir: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    width: 20,
  },
  whaleAmount: {
    color: colors.text,
    fontSize: fontSize.sm,
    flex: 1,
  },
  whaleTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  scoreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  scoreText: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  flagGreen: {
    color: colors.green,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  flagRed: {
    color: colors.red,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  verdictText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  alertText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  dcaText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
