import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { VerifiedBadge } from '../common/VerifiedBadge';
import type { AgentProfile } from '../../supabase/agentPark';

interface LeaderboardRowProps {
  rank: number;
  agent: AgentProfile;
}

export function LeaderboardRow({ rank, agent }: LeaderboardRowProps) {
  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const rankColor = rank <= 3 ? rankColors[rank - 1] : colors.textMuted;

  return (
    <View style={styles.row}>
      <Text style={[styles.rank, { color: rankColor }]}>#{rank}</Text>
      <Text style={styles.avatar}>{agent.agent_avatar}</Text>
      <View style={styles.info}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.name} numberOfLines={1}>{agent.agent_name}</Text>
          {(agent as any).domain_tier && (agent as any).domain_tier !== 'free' && (
            <VerifiedBadge tier={(agent as any).domain_tier} size="sm" />
          )}
        </View>
        <Text style={styles.meta}>Lv{agent.level} | {agent.win_rate}% WR</Text>
      </View>
      <Text style={styles.trades}>{agent.total_trades} trades</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: 2,
  },
  rank: {
    fontSize: fontSize.md,
    fontWeight: '700',
    width: 30,
    textAlign: 'center',
  },
  avatar: {
    fontSize: 14,
    marginHorizontal: spacing.sm,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    color: colors.teal,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  trades: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
});
