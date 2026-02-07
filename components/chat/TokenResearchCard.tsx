import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { useChatStore } from '../../stores/chatStore';

interface TokenData {
  name: string;
  symbol: string;
  address: string;
  price: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  txns24h?: { buys: number; sells: number };
  safetyScore: number;
  flags: string[];
  dexscreenerUrl?: string;
}

interface TokenResearchCardProps {
  data: {
    token: TokenData;
  };
}

export function TokenResearchCard({ data }: TokenResearchCardProps) {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const token = data.token;
  if (!token) return null;

  const scoreColor = token.safetyScore >= 7 ? colors.green : token.safetyScore >= 4 ? '#FFB800' : colors.red;
  const filledBars = Math.round((token.safetyScore / 10) * 10);
  const buyRatio = token.txns24h ? (token.txns24h.buys / Math.max(token.txns24h.sells, 1)) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{token.symbol} Research</Text>
          <Text style={styles.tokenName}>{token.name}</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
          <Text style={styles.scoreText}>{token.safetyScore}/10</Text>
        </View>
      </View>

      <Text style={styles.priceText}>${formatPrice(token.price)}</Text>

      {/* Price changes row */}
      <View style={styles.changesRow}>
        {token.priceChange5m != null && (
          <ChangeChip label="5m" value={token.priceChange5m} />
        )}
        {token.priceChange1h != null && (
          <ChangeChip label="1h" value={token.priceChange1h} />
        )}
        {token.priceChange6h != null && (
          <ChangeChip label="6h" value={token.priceChange6h} />
        )}
        <ChangeChip label="24h" value={token.priceChange24h} />
      </View>

      {/* Market data */}
      <View style={styles.statsGrid}>
        <StatItem label="MCap" value={`$${formatCompact(token.marketCap)}`} />
        <StatItem label="Vol" value={`$${formatCompact(token.volume24h)}`} />
        <StatItem label="Liq" value={`$${formatCompact(token.liquidity)}`} />
      </View>

      {/* Trading activity */}
      {token.txns24h && (
        <Text style={styles.metaText}>
          Trading: {formatCompact(token.txns24h.buys)} buys / {formatCompact(token.txns24h.sells)} sells
          {buyRatio != null && (
            <>  · Buy ratio: {buyRatio.toFixed(1)}x {buyRatio >= 1 ? '🟢' : '🔴'}</>
          )}
        </Text>
      )}

      {/* Safety bar */}
      <View style={styles.safetyRow}>
        <Text style={[styles.safetyLabel, { color: scoreColor }]}>
          Safety: {token.safetyScore}/10
        </Text>
        <Text style={[styles.safetyBar, { color: scoreColor }]}>
          {'█'.repeat(filledBars)}{'░'.repeat(10 - filledBars)}
        </Text>
      </View>

      {/* Flags */}
      {token.flags?.length === 0 && (
        <Text style={styles.flagGreen}>No red flags detected</Text>
      )}
      {token.flags?.map((flag, i) => (
        <Text key={i} style={styles.flagRed}>{flag.replace(/_/g, ' ')}</Text>
      ))}

      {/* Actions */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.buyBtn}
          onPress={() => sendMessage(`Buy 0.1 SOL of ${token.symbol}`)}
        >
          <Text style={styles.buyBtnText}>Buy {token.symbol}</Text>
        </TouchableOpacity>
        {token.dexscreenerUrl && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL(token.dexscreenerUrl!)}
          >
            <Text style={styles.linkBtnText}>DexScreener</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ChangeChip({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0;
  return (
    <View style={styles.changeChip}>
      <Text style={styles.changeLabel}>{label}</Text>
      <Text style={[styles.changeValue, isPositive ? styles.green : styles.red]}>
        {isPositive ? '+' : ''}{value?.toFixed(1)}%
      </Text>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatPrice(n: number): string {
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}

function formatCompact(n: number): string {
  if (!n) return '0';
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
    borderLeftColor: '#7B61FF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  tokenName: {
    color: colors.textSecondary,
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
  priceText: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  changesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  changeChip: {
    alignItems: 'center',
  },
  changeLabel: {
    color: colors.textMuted,
    fontSize: 9,
  },
  changeValue: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  green: { color: colors.green },
  red: { color: colors.red },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 9,
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  safetyLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  safetyBar: {
    fontSize: 10,
    letterSpacing: -1,
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  buyBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buyBtnText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  linkBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
