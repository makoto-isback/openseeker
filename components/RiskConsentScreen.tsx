import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { useSettingsStore } from '../stores/settingsStore';

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

interface RiskConsentScreenProps {
  onAccept: () => void;
  onSkip: () => void;
}

export function RiskConsentScreen({ onAccept, onSkip }: RiskConsentScreenProps) {
  const acceptRisk = useSettingsStore((s) => s.acceptRisk);

  const handleAccept = () => {
    acceptRisk();
    onAccept();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>[OS]</Text>
      <Text style={styles.title}>Agent Wallet Access</Text>
      <Text style={styles.subtitle}>Your agent needs permission to manage your wallet</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By continuing, you authorize your AI agent to:</Text>
        <View style={styles.permList}>
          <Text style={styles.permItem}>Execute token swaps via Jupiter</Text>
          <Text style={styles.permItem}>Set up and run DCA orders automatically</Text>
          <Text style={styles.permItem}>Create and execute limit orders and stop losses</Text>
          <Text style={styles.permItem}>Send tokens to addresses you specify</Text>
          <Text style={styles.permItem}>Interact with Solana DeFi protocols on your behalf</Text>
        </View>
        <Text style={styles.note}>
          All actions are based on YOUR instructions. The agent will never trade without your command.
        </Text>
      </View>

      <View style={styles.riskSection}>
        <Text style={styles.sectionTitle}>You understand that:</Text>
        <View style={styles.permList}>
          <Text style={styles.riskItem}>Crypto trading involves risk of financial loss</Text>
          <Text style={styles.riskItem}>AI can occasionally misinterpret instructions</Text>
          <Text style={styles.riskItem}>Transactions on Solana are irreversible</Text>
          <Text style={styles.riskItem}>You are fully responsible for your funds</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
        <Text style={styles.acceptButtonText}>I Accept — Let's Go</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipButtonText}>I'll Review Later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
  },
  logo: {
    fontSize: 36,
    fontFamily: monoFont,
    color: colors.teal,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  riskSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: '#FFB80033',
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  permList: {
    gap: spacing.sm,
  },
  permItem: {
    color: colors.text,
    fontSize: fontSize.md,
    paddingLeft: spacing.md,
    lineHeight: 22,
  },
  riskItem: {
    color: '#FFB800',
    fontSize: fontSize.md,
    paddingLeft: spacing.md,
    lineHeight: 22,
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  acceptButton: {
    backgroundColor: colors.green,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  acceptButtonText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
});
