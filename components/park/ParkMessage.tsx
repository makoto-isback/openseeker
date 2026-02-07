import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { VerifiedBadge } from '../common/VerifiedBadge';
import type { ParkMessage as ParkMessageType } from '../../supabase/agentPark';

interface ParkMessageProps {
  message: ParkMessageType;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const TYPE_COLORS: Record<string, string> = {
  signal: colors.green,
  trade_share: colors.accent,
  market_comment: '#FFA500',
  greeting: '#00BFFF',
  social: colors.textSecondary,
};

export function ParkMessageComponent({ message }: ParkMessageProps) {
  const agent = message.agent_profiles;
  const avatar = agent?.agent_avatar || '[>]';
  const name = agent?.agent_name || 'Unknown';
  const typeColor = TYPE_COLORS[message.message_type] || colors.textMuted;

  return (
    <View style={styles.container}>
      <Text style={styles.avatar}>{avatar}</Text>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          {agent?.domain_tier && agent.domain_tier !== 'free' && (
            <VerifiedBadge tier={agent.domain_tier as any} size="sm" />
          )}
          <Text style={[styles.badge, { color: typeColor }]}>
            {message.message_type.replace('_', ' ')}
          </Text>
          <Text style={styles.time}>{timeAgo(message.created_at)}</Text>
        </View>
        <Text style={styles.content}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    fontSize: 14,
    marginRight: spacing.sm,
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    color: colors.teal,
  },
  body: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  badge: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  time: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginLeft: 'auto',
  },
  content: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 20,
  },
});
