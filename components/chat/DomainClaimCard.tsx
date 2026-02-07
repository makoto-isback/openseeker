import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { useChatStore } from '../../stores/chatStore';

interface DomainClaimCardProps {
  data: {
    action: string;
    name?: string;
    domain?: string;
    tier?: string;
    price?: number;
    priceUsd?: number;
    available?: boolean;
    already_owned?: boolean;
    current_domain?: string;
    message?: string;
    // lookup data
    wallet?: string;
    agent?: any;
    error?: string;
  };
  skill: 'claim_domain' | 'lookup_domain';
}

const TIER_COLORS: Record<string, string> = {
  og: '#FFD700',
  premium: '#C77DFF',
  standard: '#1DA1F2',
};

const TIER_EMOJI: Record<string, string> = {
  og: '\u{1F451}',
  premium: '\u{1F48E}',
  standard: '\u2705',
};

export function DomainClaimCard({ data, skill }: DomainClaimCardProps) {
  const sendMessage = useChatStore((s) => s.sendMessage);

  // Lookup result
  if (skill === 'lookup_domain') {
    if (data.error) {
      return (
        <View style={[styles.card, { borderLeftColor: colors.red }]}>
          <Text style={styles.cardTitle}>Domain Lookup</Text>
          <Text style={styles.metaText}>{data.error}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.card, { borderLeftColor: TIER_COLORS[data.tier || 'standard'] || '#1DA1F2' }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{data.domain}</Text>
          <Text style={[styles.badge, { color: TIER_COLORS[data.tier || 'standard'] }]}>
            {TIER_EMOJI[data.tier || 'standard']} {(data.tier || 'standard').toUpperCase()}
          </Text>
        </View>
        {data.agent && (
          <>
            <Text style={styles.agentName}>{data.agent.name}</Text>
            {data.agent.level && <Text style={styles.metaText}>Level {data.agent.level} · {data.agent.trades || 0} trades</Text>}
          </>
        )}
        <Text style={styles.walletText}>{data.wallet}</Text>
      </View>
    );
  }

  // Already owns a domain
  if (data.already_owned) {
    return (
      <View style={[styles.card, { borderLeftColor: '#1DA1F2' }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{data.current_domain}</Text>
          <Text style={[styles.badge, { color: '#1DA1F2' }]}>{TIER_EMOJI[data.tier || 'standard']} VERIFIED</Text>
        </View>
        <Text style={styles.metaText}>{data.message || 'You already have a verified .os domain!'}</Text>
      </View>
    );
  }

  // Not available
  if (data.available === false) {
    return (
      <View style={[styles.card, { borderLeftColor: colors.red }]}>
        <Text style={styles.cardTitle}>{data.domain || `${data.name}.os`}</Text>
        <Text style={styles.metaText}>This domain is already taken.</Text>
      </View>
    );
  }

  // Claim card
  const tierColor = TIER_COLORS[data.tier || 'standard'] || '#1DA1F2';
  const tierEmoji = TIER_EMOJI[data.tier || 'standard'] || '\u2705';
  const tierLabel = data.tier === 'og' ? 'OG' : data.tier === 'premium' ? 'Premium' : 'Standard';

  return (
    <View style={[styles.card, { borderLeftColor: tierColor }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{tierEmoji} Claim Your .os Identity</Text>
        <Text style={[styles.badge, { color: tierColor }]}>{tierLabel.toUpperCase()}</Text>
      </View>

      <Text style={styles.domainName}>{data.domain || `${data.name}.os`}</Text>

      <View style={styles.infoRow}>
        <Text style={styles.metaText}>Tier: {tierLabel} ({data.name?.length || 0} chars)</Text>
        <Text style={[styles.priceText, { color: tierColor }]}>
          {data.price} SOL {data.priceUsd ? `(~$${data.priceUsd.toFixed(2)})` : ''}
        </Text>
      </View>

      <View style={styles.benefitsList}>
        <Text style={styles.benefitText}>{'\u2705'} Verified badge everywhere</Text>
        <Text style={styles.benefitText}>{'\u2705'} .os address for receiving tokens</Text>
        <Text style={styles.benefitText}>{'\u2705'} Higher trust from other agents</Text>
        <Text style={styles.benefitText}>{'\u2705'} Renewable yearly</Text>
      </View>

      <TouchableOpacity
        style={[styles.claimButton, { backgroundColor: tierColor }]}
        onPress={() => sendMessage(`claim ${data.name}.os`)}
      >
        <Text style={styles.claimButtonText}>Claim {data.domain || `${data.name}.os`} — {data.price} SOL</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => {}}
      >
        <Text style={styles.skipText}>Maybe later</Text>
      </TouchableOpacity>
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
    borderLeftColor: '#1DA1F2',
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
  badge: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  domainName: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priceText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  benefitsList: {
    marginBottom: spacing.md,
    gap: 4,
  },
  benefitText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  claimButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  claimButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  agentName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: 2,
  },
  walletText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    marginTop: spacing.xs,
  },
});
