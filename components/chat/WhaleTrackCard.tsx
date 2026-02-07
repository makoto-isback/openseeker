import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

interface WhaleTrackCardProps {
  data: {
    action?: string;
    wallet: string;
    label: string;
    message: string;
    transactions?: Array<{
      type: string;
      description: string;
      timestamp: number;
    }>;
    source?: string;
  };
  type: 'track' | 'activity' | 'stop';
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function WhaleTrackCard({ data, type }: WhaleTrackCardProps) {
  if (type === 'stop') {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Whale Untracked</Text>
          <Text style={[styles.cardBadge, { color: colors.red }]}>STOP</Text>
        </View>
        <Text style={styles.metaText}>
          Stopped tracking {data.wallet.slice(0, 8)}...{data.wallet.slice(-4)}
        </Text>
      </View>
    );
  }

  if (type === 'track') {
    return (
      <View style={[styles.card, { borderLeftColor: '#9B59B6' }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Whale Tracked</Text>
          <Text style={[styles.cardBadge, { color: '#9B59B6' }]}>TRACK</Text>
        </View>
        <Text style={styles.labelText}>{data.label}</Text>
        <Text style={styles.addressText}>
          {data.wallet.slice(0, 12)}...{data.wallet.slice(-8)}
        </Text>
        <Text style={styles.metaText}>
          You'll be notified of their trading activity.
        </Text>
      </View>
    );
  }

  // Activity view
  return (
    <View style={[styles.card, { borderLeftColor: '#9B59B6' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{data.label} Activity</Text>
        <Text style={[styles.cardBadge, { color: '#9B59B6' }]}>WHALE</Text>
      </View>
      <Text style={styles.addressText}>
        {data.wallet.slice(0, 12)}...{data.wallet.slice(-8)}
      </Text>

      {data.transactions?.map((tx, i) => (
        <View key={i} style={styles.txRow}>
          <View style={[styles.txBadge, { backgroundColor: tx.type === 'SWAP' ? '#2196F3' : '#4CAF50' }]}>
            <Text style={styles.txBadgeText}>{tx.type}</Text>
          </View>
          <View style={styles.txInfo}>
            <Text style={styles.txDesc}>{tx.description}</Text>
            <Text style={styles.txTime}>{timeAgo(tx.timestamp)}</Text>
          </View>
        </View>
      ))}

      {data.source === 'mock' && <Text style={styles.mockText}>Simulated data</Text>}
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
    borderLeftColor: colors.accent,
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
  labelText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  addressText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    marginBottom: spacing.sm,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.card,
  },
  txBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    color: colors.text,
    fontSize: fontSize.sm,
  },
  txTime: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  mockText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
