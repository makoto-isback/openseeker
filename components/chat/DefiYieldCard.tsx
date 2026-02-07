import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { useChatStore } from '../../stores/chatStore';

interface Pool {
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase?: number;
  apyReward?: number;
  category: string;
  difficulty: string;
  action: string;
  il7d?: number | null;
}

interface DefiYieldCardProps {
  data: {
    pools: Pool[];
  };
}

const STAKE_MAP: Record<string, { from: string; to: string }> = {
  jitosol: { from: 'SOL', to: 'JITO' },
  msol: { from: 'SOL', to: 'MSOL' },
  bsol: { from: 'SOL', to: 'BSOL' },
};

export function DefiYieldCard({ data }: DefiYieldCardProps) {
  const sendMessage = useChatStore((s) => s.sendMessage);

  const handleStake = (pool: Pool) => {
    const sym = pool.symbol.toLowerCase();
    const match = Object.entries(STAKE_MAP).find(([k]) => sym.includes(k));
    if (match) {
      sendMessage(`Stake 1 SOL into ${pool.symbol}`);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Top Solana Yields</Text>
        <Text style={styles.cardBadge}>DEFI</Text>
      </View>

      {data.pools?.map((pool, i) => {
        const canStake = pool.action === 'swap';
        const isLP = pool.category === 'lp_volatile' || pool.category === 'lp_stable';
        return (
          <View key={i} style={styles.poolRow}>
            <View style={styles.poolInfo}>
              <View style={styles.poolHeader}>
                <Text style={styles.poolRank}>{i + 1}.</Text>
                <Text style={styles.poolSymbol}>{pool.symbol}</Text>
                <Text style={styles.poolApy}>{pool.apy?.toFixed(1)}% APY</Text>
                {canStake && <Text style={styles.starBadge}>*</Text>}
              </View>
              <Text style={styles.poolMeta}>
                {pool.project} · ${formatCompact(pool.tvlUsd)} TVL · {pool.difficulty}
              </Text>
              {isLP && pool.il7d != null && (
                <Text style={styles.warningText}>IL risk</Text>
              )}
              {isLP && pool.il7d == null && (
                <Text style={styles.warningText}>Impermanent loss risk</Text>
              )}
            </View>
            {canStake && (
              <TouchableOpacity style={styles.stakeBtn} onPress={() => handleStake(pool)}>
                <Text style={styles.stakeBtnText}>Stake</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
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
    borderLeftColor: '#00d4aa',
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
    color: '#00d4aa',
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  poolInfo: {
    flex: 1,
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  poolRank: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    width: 18,
  },
  poolSymbol: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  poolApy: {
    color: colors.green,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  starBadge: {
    color: '#FFB800',
    fontSize: fontSize.sm,
    marginLeft: 2,
  },
  poolMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginLeft: 18,
    marginTop: 1,
  },
  warningText: {
    color: '#FFB800',
    fontSize: fontSize.xs,
    marginLeft: 18,
    fontStyle: 'italic',
  },
  stakeBtn: {
    backgroundColor: colors.green,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  stakeBtnText: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
