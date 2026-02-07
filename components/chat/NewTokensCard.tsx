import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

interface NewTokensCardProps {
  data: {
    tokens: Array<{
      name: string;
      symbol: string;
      address: string;
      price: number;
      priceChange24h: number;
      volume24h: number;
      liquidity: number;
      marketCap: number;
      ageHours: number | null;
      safetyScore: number;
      flags: string[];
      dexscreenerUrl?: string;
    }>;
  };
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
}

function formatAge(hours: number | null): string {
  if (hours === null) return '?';
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  if (hours < 168) return `${Math.floor(hours / 24)}d`;
  return `${Math.floor(hours / 168)}w`;
}

function getScoreColor(score: number): string {
  if (score >= 7) return colors.green;
  if (score >= 4) return '#FFB800';
  return colors.red;
}

export function NewTokensCard({ data }: NewTokensCardProps) {
  const tokens = data?.tokens || [];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>New Tokens</Text>
        <Text style={[styles.cardBadge, { color: '#E91E63' }]}>NEW</Text>
      </View>

      {tokens.length === 0 ? (
        <Text style={styles.metaText}>No new tokens found matching criteria.</Text>
      ) : (
        tokens.map((token, i) => (
          <View key={i} style={styles.tokenRow}>
            <View style={styles.tokenHeader}>
              <View style={styles.tokenName}>
                <Text style={styles.symbol}>{token.symbol}</Text>
                <Text style={styles.name} numberOfLines={1}>{token.name}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(token.safetyScore) }]}>
                <Text style={styles.scoreText}>{token.safetyScore}/10</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <Text style={styles.priceText}>{formatPrice(token.price)}</Text>
              <Text style={[
                styles.changeText,
                token.priceChange24h >= 0 ? styles.green : styles.red
              ]}>
                {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h?.toFixed(1)}%
              </Text>
              <Text style={styles.ageText}>{formatAge(token.ageHours)}</Text>
            </View>

            <View style={styles.metricsRow}>
              <Text style={styles.metricText}>Vol: ${formatCompact(token.volume24h)}</Text>
              <Text style={styles.metricText}>Liq: ${formatCompact(token.liquidity)}</Text>
              {token.marketCap > 0 && <Text style={styles.metricText}>MC: ${formatCompact(token.marketCap)}</Text>}
            </View>

            {token.flags.length > 0 && (
              <View style={styles.flagsRow}>
                {token.flags.map((flag, j) => (
                  <Text key={j} style={styles.flagText}>{flag.replace(/_/g, ' ')}</Text>
                ))}
              </View>
            )}
          </View>
        ))
      )}

      <Text style={styles.disclaimerText}>
        New tokens are extremely risky. DYOR. Not financial advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: '#E91E63',
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
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  tokenRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.card,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  symbol: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  name: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  priceText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  changeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  green: { color: colors.green },
  red: { color: colors.red },
  ageText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginLeft: 'auto',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  metricText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  flagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  flagText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(255,68,68,0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  disclaimerText: {
    color: colors.red,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    fontStyle: 'italic',
    fontWeight: '600',
  },
});
