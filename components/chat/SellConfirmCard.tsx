import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { TransactionCard } from './TransactionCard';
import { executeSwap, type SwapResult } from '../../services/swap';

interface SellConfirmCardProps {
  data: {
    action: string;
    from: { symbol: string; amount: number };
    to: { symbol: string; amount: number };
    rate: number;
    price_impact: number;
    min_received: number;
    slippage: string;
    route: string;
    source: string;
    rawQuote?: any;
    message: string;
  };
}

function formatNum(n: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function SellConfirmCard({ data }: SellConfirmCardProps) {
  const [state, setState] = useState<'idle' | 'confirming' | 'cancelled'>('idle');
  const [result, setResult] = useState<SwapResult | null>(null);

  const isEmergency = data.action === 'go_stablecoin';
  const isRotate = data.action === 'rotate_token';
  const label = isEmergency ? 'EXIT' : isRotate ? 'ROTATE' : 'SELL';
  const accentColor = isEmergency ? colors.red : isRotate ? colors.accent : '#FF6B35';

  const handleConfirm = async () => {
    setState('confirming');
    try {
      const swapResult = await executeSwap({
        from: data.from,
        to: data.to,
        rawQuote: data.rawQuote,
        source: data.source,
      });
      setResult(swapResult);
    } catch (err: any) {
      setState('idle');
    }
  };

  if (result) {
    return (
      <TransactionCard
        txSignature={result.txSignature}
        fromSymbol={result.fromSymbol}
        fromAmount={result.fromAmount}
        toSymbol={result.toSymbol}
        toAmount={result.toAmount}
        timestamp={result.timestamp}
        source={result.source}
      />
    );
  }

  if (state === 'cancelled') {
    return (
      <View style={styles.card}>
        <Text style={styles.cancelledText}>{label} cancelled</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {isEmergency ? 'Emergency Exit' : isRotate ? 'Rotate Position' : `Sell ${data.from.symbol}`}
        </Text>
        <Text style={[styles.cardBadge, { color: accentColor }]}>{label}</Text>
      </View>

      <View style={styles.swapRow}>
        <Text style={styles.swapText}>{data.from.amount} {data.from.symbol}</Text>
        <Text style={styles.swapArrow}>→</Text>
        <Text style={styles.swapText}>{formatNum(data.to.amount)} {data.to.symbol}</Text>
      </View>

      <Text style={styles.metaText}>Rate: 1 {data.from.symbol} = {formatNum(data.rate)} {data.to.symbol}</Text>
      <Text style={styles.metaText}>Impact: {data.price_impact}% | Slippage: {data.slippage}</Text>
      <Text style={styles.metaText}>Route: {data.route}</Text>
      {data.source === 'mock' && <Text style={styles.mockText}>Simulated quote</Text>}

      {isEmergency && (
        <Text style={styles.warningText}>
          This will convert all specified tokens to USDC immediately.
        </Text>
      )}

      {state === 'confirming' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={styles.loadingText}>
            {isEmergency ? 'Exiting position...' : isRotate ? 'Rotating...' : 'Selling...'}
          </Text>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.confirmButton, { backgroundColor: accentColor }]} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>
              {isEmergency ? 'Confirm Exit' : isRotate ? 'Confirm Rotate' : 'Confirm Sell'}
            </Text>
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
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  swapText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  swapArrow: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  mockText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  warningText: {
    color: colors.red,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  confirmButton: {
    flex: 1,
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
    backgroundColor: colors.card,
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
