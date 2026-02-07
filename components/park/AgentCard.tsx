import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { VerifiedBadge } from '../common/VerifiedBadge';
import type { AgentProfile } from '../../supabase/agentPark';

interface AgentCardProps {
  profile: AgentProfile | null;
  level: number;
  levelEmoji: string;
  levelTitle: string;
  xp: number;
  xpProgress: number;
}

export function AgentCard({ profile, level, levelEmoji, levelTitle, xp, xpProgress }: AgentCardProps) {
  const name = profile?.agent_name || 'DegenCat';
  const avatar = profile?.agent_avatar || '(=^.^=)';
  const trades = profile?.total_trades || 0;
  const winRate = profile?.win_rate || 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.avatar}>{avatar}</Text>
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.name}>{name}</Text>
            {(profile as any)?.domain_tier && (profile as any).domain_tier !== 'free' && (
              <VerifiedBadge tier={(profile as any).domain_tier} size="md" />
            )}
          </View>
          {(profile as any)?.os_domain && (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 1 }}>
              {(profile as any).os_domain}
            </Text>
          )}
          <Text style={styles.levelText}>
            {levelEmoji} {levelTitle} (Lv{level})
          </Text>
        </View>
      </View>

      {/* XP Progress Bar */}
      <View style={styles.xpRow}>
        <Text style={styles.xpLabel}>{xp} XP</Text>
        <View style={styles.xpBar}>
          <View style={[styles.xpFill, { width: `${Math.min(xpProgress * 100, 100)}%` }]} />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{trades}</Text>
          <Text style={styles.statLabel}>Trades</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{winRate}%</Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{profile?.total_profit_pct?.toFixed(1) || '0.0'}%</Text>
          <Text style={styles.statLabel}>Profit</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    fontSize: 24,
    marginRight: spacing.md,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    color: colors.teal,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  levelText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  xpLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    width: 60,
  },
  xpBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
