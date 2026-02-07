import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { useChatStore } from '../../stores/chatStore';

interface Token {
  name: string;
  symbol: string;
  address: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  safetyScore: number;
  flags: string[];
}

interface TrendingTokensCardProps {
  data: {
    tokens: Token[];
  };
}

export function TrendingTokensCard({ data }: TrendingTokensCardProps) {
  const sendMessage = useChatStore((s) => s.sendMessage);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Trending on Solana</Text>
        <Text style={styles.cardBadge}>TRENDING</Text>
      </View>

      {data.tokens?.map((token, i) => {
        const isPositive = token.priceChange24h >= 0;
        const isRisky = token.safetyScore < 4;
        const scorePct = token.safetyScore / 10;
        const filledBars = Math.round(scorePct * 10);

        return (
          <View key={i} style={styles.tokenRow}>
            <View style={styles.tokenInfo}>
              <View style={styles.tokenHeader}>
                <Text style={styles.tokenRank}>{i + 1}.</Text>
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                <Text style={styles.tokenPrice}>${formatPrice(token.price)}</Text>
                <Text style={[styles.tokenChange, isPositive ? styles.green : styles.red]}>
                  {isPositive ? '+' : ''}{token.priceChange24h?.toFixed(1)}%
                </Text>
              </View>
              <Text style={styles.tokenMeta}>
                Vol: ${formatCompact(token.volume24h)} · Liq: ${formatCompact(token.liquidity)}
              </Text>
              <View style={styles.safetyRow}>
                <Text style={styles.safetyLabel}>Safety: {token.safetyScore}/10</Text>
                <Text style={styles.safetyBar}>
                  {'█'.repeat(filledBars)}{'░'.repeat(10 - filledBars)}
                </Text>
                {isRisky && <Text style={styles.riskyBadge}>RISKY</Text>}
              </View>
            </View>
            <TouchableOpacity
              style={styles.buyBtn}
              onPress={() => sendMessage(`Buy 0.1 SOL of ${token.symbol}`)}
            >
              <Text style={styles.buyBtnText}>Buy</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Text style={styles.disclaimer}>
        Memecoins are extremely volatile. Never invest more than you can afford to lose.
      </Text>
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
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
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
    color: '#FF6B35',
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tokenRank: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    width: 18,
  },
  tokenSymbol: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  tokenPrice: {
    color: colors.text,
    fontSize: fontSize.sm,
  },
  tokenChange: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
  },
  green: { color: colors.green },
  red: { color: colors.red },
  tokenMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginLeft: 18,
    marginTop: 1,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 18,
    marginTop: 2,
    gap: spacing.xs,
  },
  safetyLabel: {
    color: colors.textMuted,
    fontSize: 9,
  },
  safetyBar: {
    fontSize: 8,
    color: colors.green,
    letterSpacing: -1,
  },
  riskyBadge: {
    color: colors.red,
    fontSize: 8,
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  buyBtnText: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#FFB800',
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
