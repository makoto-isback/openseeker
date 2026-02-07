import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { TransactionCard } from './TransactionCard';
import { sendSOL, type SendResult } from '../../services/transfer';

interface SendConfirmCardProps {
  data: {
    action: string;
    send: {
      to: string;
      amount: number;
      token: string;
    };
    message: string;
  };
}

export function SendConfirmCard({ data }: SendConfirmCardProps) {
  const [state, setState] = useState<'idle' | 'confirming' | 'cancelled'>('idle');
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { send } = data;

  const handleConfirm = async () => {
    setState('confirming');
    setError(null);
    try {
      const sendResult = await sendSOL(send.to, send.amount);
      setResult(sendResult);
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
      setState('idle');
    }
  };

  if (result) {
    return (
      <TransactionCard
        txSignature={result.txSignature}
        fromSymbol={result.token}
        fromAmount={result.amount}
        toSymbol={result.token}
        toAmount={result.amount}
        timestamp={result.timestamp}
        source={result.source}
      />
    );
  }

  if (state === 'cancelled') {
    return (
      <View style={styles.card}>
        <Text style={styles.cancelledText}>Transfer cancelled</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderLeftColor: '#FF6B35' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Send {send.token}</Text>
        <Text style={[styles.cardBadge, { color: '#FF6B35' }]}>SEND</Text>
      </View>

      <Text style={styles.amountText}>{send.amount} {send.token}</Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>To:</Text>
        <Text style={styles.detailValue}>{send.to.slice(0, 12)}...{send.to.slice(-8)}</Text>
      </View>

      <Text style={styles.warningText}>
        Transfers are irreversible. Please verify the address.
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {state === 'confirming' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingText}>Sending...</Text>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setState('cancelled')}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  amountText: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    width: 30,
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    flex: 1,
  },
  warningText: {
    color: '#FFB800',
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  errorText: {
    color: colors.red,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.red,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  cancelledText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontStyle: 'italic',
  },
});
