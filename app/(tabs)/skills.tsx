import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { getTodaySpend, getMonthSpend } from '../../services/spending';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

interface SkillInfo {
  id: string;
  icon: string;
  name: string;
  description: string;
  cost: string;
  example: string;
}

const SKILLS: SkillInfo[] = [
  {
    id: 'price_check',
    icon: '$',
    name: 'Price Check',
    description: 'Real-time token prices with 24h change',
    cost: '$0.002',
    example: '"What\'s the price of SOL?"',
  },
  {
    id: 'portfolio_track',
    icon: '#',
    name: 'Portfolio Track',
    description: 'Full portfolio value with P&L per token',
    cost: '$0.002',
    example: '"Show my portfolio"',
  },
  {
    id: 'swap_quote',
    icon: '<>',
    name: 'Swap Quote',
    description: 'Jupiter swap quotes with execution',
    cost: '$0.003',
    example: '"Swap 1 SOL to WIF"',
  },
  {
    id: 'whale_watch',
    icon: '~',
    name: 'Whale Watch',
    description: 'Track large transactions and whale sentiment',
    cost: '$0.002',
    example: '"Show whale activity for SOL"',
  },
  {
    id: 'token_research',
    icon: '?',
    name: 'Token Research',
    description: 'Safety scores, flags, and market analysis',
    cost: '$0.002',
    example: '"Is WIF safe to buy?"',
  },
  {
    id: 'price_alert',
    icon: '!',
    name: 'Price Alert',
    description: 'Set alerts for price thresholds',
    cost: '$0.002',
    example: '"Alert me when SOL hits $200"',
  },
  {
    id: 'dca_setup',
    icon: '^',
    name: 'DCA Setup',
    description: 'Dollar-cost averaging automation',
    cost: '$0.002',
    example: '"DCA $10 USDC into SOL daily"',
  },
  {
    id: 'news_digest',
    icon: '*',
    name: 'News Digest',
    description: 'Latest crypto news and trending tokens',
    cost: '$0.002',
    example: '"What\'s the latest Solana news?"',
  },
];

const COMING_SOON = [
  { icon: '[nft]', name: 'NFT Tracker', description: 'Monitor floor prices and rare listings' },
  { icon: '[air]', name: 'Airdrop Monitor', description: 'Track airdrop eligibility and claims' },
  { icon: '[soc]', name: 'Social Sentiment', description: 'Twitter/Discord mood analysis' },
];

export default function SkillsScreen() {
  const [todaySpend, setTodaySpend] = useState(0);
  const [monthSpend, setMonthSpend] = useState(0);

  useEffect(() => {
    loadSpending();
  }, []);

  const loadSpending = async () => {
    const today = await getTodaySpend();
    const month = await getMonthSpend();
    setTodaySpend(today);
    setMonthSpend(month);
  };

  const showSkillDetails = (skill: SkillInfo) => {
    Alert.alert(
      `${skill.icon} ${skill.name}`,
      `${skill.description}\n\nCost: ${skill.cost} per use\n\nTry: ${skill.example}`,
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats Header */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>${todaySpend.toFixed(4)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>This Month</Text>
          <Text style={styles.statValue}>${monthSpend.toFixed(4)}</Text>
        </View>
      </View>

      {/* Skills Grid */}
      <Text style={styles.sectionTitle}>Active Skills</Text>
      <View style={styles.grid}>
        {SKILLS.map((skill) => (
          <TouchableOpacity
            key={skill.id}
            style={styles.skillCard}
            onPress={() => showSkillDetails(skill)}
          >
            <Text style={styles.skillIcon}>{skill.icon}</Text>
            <Text style={styles.skillName}>{skill.name}</Text>
            <Text style={styles.skillDesc} numberOfLines={2}>{skill.description}</Text>
            <Text style={styles.skillCost}>{skill.cost}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Coming Soon */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Coming Soon</Text>
      {COMING_SOON.map((item, i) => (
        <View key={i} style={styles.comingSoonCard}>
          <Text style={styles.comingSoonIcon}>{item.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.comingSoonName}>{item.name}</Text>
            <Text style={styles.comingSoonDesc}>{item.description}</Text>
          </View>
          <Text style={styles.comingSoonBadge}>SOON</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  skillCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  skillIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
    fontFamily: monoFont,
    color: colors.teal,
  },
  skillName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  skillDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 14,
    marginBottom: spacing.sm,
  },
  skillCost: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  comingSoonCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    opacity: 0.6,
  },
  comingSoonIcon: {
    fontSize: 14,
    fontFamily: monoFont,
    color: colors.teal,
  },
  comingSoonName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  comingSoonDesc: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  comingSoonBadge: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
});
