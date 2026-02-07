import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

interface TransactionCardProps {
  txSignature: string;
  fromSymbol: string;
  fromAmount: number;
  toSymbol: string;
  toAmount: number;
  timestamp: number;
  source?: string;
}

export function TransactionCard({
  txSignature,
  fromSymbol,
  fromAmount,
  toSymbol,
  toAmount,
  timestamp,
  source,
}: TransactionCardProps) {
  const truncatedSig = `${txSignature.slice(0, 8)}...${txSignature.slice(-8)}`;
  const time = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const openExplorer = () => {
    Linking.openURL(`https://solscan.io/tx/${txSignature}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Swap Complete!</Text>
        <Text style={styles.badge}>TX</Text>
      </View>

      <View style={styles.swapRow}>
        <Text style={styles.amount}>{fromAmount} {fromSymbol}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.amount}>{formatNum(toAmount)} {toSymbol}</Text>
      </View>

      <TouchableOpacity onPress={openExplorer}>
        <Text style={styles.sigText}>Tx: {truncatedSig}</Text>
      </TouchableOpacity>

      <Text style={styles.timeText}>{time}</Text>
      {source === 'mock' && <Text style={styles.mockText}>Simulated transaction</Text>}
    </View>
  );
}

function formatNum(n: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.green,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.green,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  badge: {
    color: colors.green,
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  amount: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  arrow: {
    color: colors.green,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  sigText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
  timeText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  mockText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
