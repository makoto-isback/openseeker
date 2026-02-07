import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Clipboard,
  Alert,
} from 'react-native';
import { useWalletStore } from '../../stores/walletStore';
import { getDCAConfigs, type DCAConfig } from '../../services/dca';
import { getAlerts, type PriceAlert } from '../../services/alerts';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

export default function PortfolioScreen() {
  const address = useWalletStore((s) => s.address);
  const balance = useWalletStore((s) => s.balance);
  const holdings = useWalletStore((s) => s.holdings);
  const totalUsd = useWalletStore((s) => s.totalUsd);
  const portfolioData = useWalletStore((s) => s.portfolioData);
  const holdingsLoading = useWalletStore((s) => s.holdingsLoading);
  const refreshHoldings = useWalletStore((s) => s.refreshHoldings);

  const [dcaConfigs, setDcaConfigs] = useState<DCAConfig[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      await refreshHoldings();

      const configs = await getDCAConfigs();
      setDcaConfigs(configs.filter((c) => c.active));

      const alertList = await getAlerts();
      setAlerts(alertList.filter((a) => !a.triggered));
    } catch (err) {
      console.log('[Portfolio] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [refreshHoldings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading && !portfolioData) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const solData = portfolioData;
  const hasHoldings = (solData && solData.sol > 0) || holdings.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Total Portfolio Value</Text>
        <Text style={styles.totalValue}>${formatNum(totalUsd)}</Text>
        {holdingsLoading && <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 4 }} />}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onRefresh}>
          <Text style={styles.actionText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Holdings */}
      <Text style={styles.sectionTitle}>Holdings</Text>
      {!hasHoldings ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tokens yet. Send SOL to get started.</Text>
          {address && (
            <TouchableOpacity
              style={styles.copyAddressButton}
              onPress={() => {
                Clipboard.setString(address);
                Alert.alert('Copied', 'Wallet address copied to clipboard');
              }}
            >
              <Text style={styles.copyAddressText}>{address}</Text>
              <Text style={styles.copyHint}>[tap to copy]</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {/* SOL holding */}
          {solData && solData.sol > 0 && (
            <TouchableOpacity
              style={styles.holdingCard}
              onPress={() => setExpandedIdx(expandedIdx === -1 ? null : -1)}
            >
              <View style={styles.holdingHeader}>
                <View>
                  <Text style={styles.holdingSymbol}>SOL</Text>
                  <Text style={styles.holdingMeta}>{solData.sol.toFixed(4)} tokens</Text>
                </View>
                <View style={styles.holdingRight}>
                  <Text style={styles.holdingValue}>${formatNum(solData.solUsdValue)}</Text>
                  <Text style={[styles.holdingChange, solData.solChange24h >= 0 ? styles.green : styles.red]}>
                    {solData.solChange24h >= 0 ? '+' : ''}{solData.solChange24h.toFixed(1)}% 24h
                  </Text>
                </View>
              </View>
              {expandedIdx === -1 && (
                <View style={styles.expandedRow}>
                  <Text style={styles.expandedText}>Price: ${formatNum(solData.solUsdPrice)}</Text>
                  <Text style={styles.expandedText}>24h Change: {solData.solChange24h >= 0 ? '+' : ''}{solData.solChange24h.toFixed(2)}%</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* SPL token holdings */}
          {holdings.map((h, i) => (
            <TouchableOpacity
              key={h.mint}
              style={styles.holdingCard}
              onPress={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              <View style={styles.holdingHeader}>
                <View>
                  <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                  <Text style={styles.holdingMeta}>{formatTokenAmount(h.amount)} tokens</Text>
                </View>
                <View style={styles.holdingRight}>
                  <Text style={styles.holdingValue}>
                    {h.usdValue > 0 ? `$${formatNum(h.usdValue)}` : '--'}
                  </Text>
                  {h.change24h !== 0 && (
                    <Text style={[styles.holdingChange, h.change24h >= 0 ? styles.green : styles.red]}>
                      {h.change24h >= 0 ? '+' : ''}{h.change24h.toFixed(1)}% 24h
                    </Text>
                  )}
                </View>
              </View>
              {expandedIdx === i && (
                <View style={styles.expandedRow}>
                  {h.usdPrice > 0 && (
                    <Text style={styles.expandedText}>Price: ${formatNum(h.usdPrice)}</Text>
                  )}
                  <Text style={styles.expandedMeta}>Mint: {h.mint.slice(0, 12)}...{h.mint.slice(-8)}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Active Automations */}
      {(dcaConfigs.length > 0 || alerts.length > 0) && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Active Automations</Text>

          {dcaConfigs.map((dca) => (
            <View key={dca.id} style={styles.autoCard}>
              <Text style={styles.autoIcon}>[dca]</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.autoTitle}>DCA: {dca.amount} {dca.fromToken} → {dca.toToken}</Text>
                <Text style={styles.autoMeta}>Every {dca.intervalHours}h | {dca.totalExecuted} executions</Text>
              </View>
            </View>
          ))}

          {alerts.map((alert) => (
            <View key={alert.id} style={styles.autoCard}>
              <Text style={styles.autoIcon}>[!]</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.autoTitle}>{alert.token} {alert.condition} ${alert.targetPrice}</Text>
                <Text style={styles.autoMeta}>Price alert</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {address && (
        <Text style={[styles.walletAddress, { marginTop: spacing.xl }]}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </Text>
      )}
    </ScrollView>
  );
}

function formatNum(n: number): string {
  if (n == null || isNaN(n)) return '0.00';
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatTokenAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(6);
}

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  headerLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  totalValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
  },
  green: {
    color: colors.green,
  },
  red: {
    color: colors.red,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  copyAddressButton: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyAddressText: {
    color: colors.teal,
    fontSize: fontSize.xs,
    fontFamily: monoFont,
  },
  copyHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  holdingCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holdingSymbol: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  holdingMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  holdingChange: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: 2,
  },
  expandedRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandedText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: 2,
  },
  expandedMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  autoCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  autoIcon: {
    fontSize: 14,
    fontFamily: monoFont,
    color: colors.teal,
  },
  autoTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  autoMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  walletAddress: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
