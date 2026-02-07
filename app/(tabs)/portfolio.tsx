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

} from 'react-native';
import { useMemoryStore } from '../../stores/memoryStore';
import { useWalletStore } from '../../stores/walletStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { parseWalletMd, type TokenHolding } from '../../services/walletParser';
import { getDCAConfigs, type DCAConfig } from '../../services/dca';
import { getAlerts, type PriceAlert } from '../../services/alerts';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

interface EnrichedHolding extends TokenHolding {
  currentPrice: number;
  currentValue: number;
  change24h: number;
  pnlPercent: number;
}

export default function PortfolioScreen() {
  const wallet = useMemoryStore((s) => s.wallet);
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const walletAddress = useWalletStore((s) => s.address);

  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalChange, setTotalChange] = useState(0);
  const [dcaConfigs, setDcaConfigs] = useState<DCAConfig[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const parsed = parseWalletMd(wallet);
      if (parsed.length === 0) {
        setHoldings([]);
        setTotalValue(0);
        setTotalChange(0);
        setLoading(false);
        return;
      }

      // Fetch live prices
      const enriched: EnrichedHolding[] = [];
      let total = 0;
      let totalCost = 0;

      for (const h of parsed) {
        let currentPrice = h.avgEntry;
        let change24h = 0;
        try {
          const res = await fetch(`${serverUrl}/price/${h.symbol}?detailed=true`, {
            signal: timeoutSignal(5000),
          });
          if (res.ok) {
            const data = await res.json();
            currentPrice = data.price || h.avgEntry;
            change24h = data.change_24h || 0;
          }
        } catch {}

        const currentValue = h.amount * currentPrice;
        const costBasis = h.amount * h.avgEntry;
        const pnlPercent = h.avgEntry > 0 ? ((currentPrice - h.avgEntry) / h.avgEntry) * 100 : 0;

        total += currentValue;
        totalCost += costBasis;

        enriched.push({
          ...h,
          currentPrice,
          currentValue,
          change24h,
          pnlPercent,
        });
      }

      setHoldings(enriched);
      setTotalValue(total);
      setTotalChange(totalCost > 0 ? ((total - totalCost) / totalCost) * 100 : 0);

      // Load automations
      const configs = await getDCAConfigs();
      setDcaConfigs(configs.filter((c) => c.active));

      const alertList = await getAlerts();
      setAlerts(alertList.filter((a) => !a.triggered));
    } catch (err) {
      console.log('[Portfolio] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [wallet, serverUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isPositive = totalChange >= 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Total Portfolio Value</Text>
        <Text style={styles.totalValue}>${formatNum(totalValue)}</Text>
        {totalValue > 0 && (
          <Text style={[styles.totalChange, isPositive ? styles.green : styles.red]}>
            {isPositive ? '+' : ''}{totalChange.toFixed(2)}% all time
          </Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onRefresh}>
          <Text style={styles.actionText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Holdings */}
      <Text style={styles.sectionTitle}>Holdings</Text>
      {holdings.length === 0 ? (
        <Text style={styles.emptyText}>No holdings in WALLET.md. Edit in Settings to add tokens.</Text>
      ) : (
        holdings.map((h, i) => (
          <TouchableOpacity
            key={i}
            style={styles.holdingCard}
            onPress={() => setExpandedIdx(expandedIdx === i ? null : i)}
          >
            <View style={styles.holdingHeader}>
              <View>
                <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                <Text style={styles.holdingMeta}>{h.amount} tokens</Text>
              </View>
              <View style={styles.holdingRight}>
                <Text style={styles.holdingValue}>${formatNum(h.currentValue)}</Text>
                <Text style={[styles.holdingChange, h.pnlPercent >= 0 ? styles.green : styles.red]}>
                  {h.pnlPercent >= 0 ? '+' : ''}{h.pnlPercent.toFixed(1)}%
                </Text>
              </View>
            </View>
            {expandedIdx === i && (
              <View style={styles.expandedRow}>
                <Text style={styles.expandedText}>Price: ${formatNum(h.currentPrice)}</Text>
                <Text style={styles.expandedText}>Avg Entry: ${formatNum(h.avgEntry)}</Text>
                <Text style={styles.expandedText}>Invested: ${formatNum(h.amount * h.avgEntry)}</Text>
                <Text style={[styles.expandedText, h.pnlPercent >= 0 ? styles.green : styles.red]}>
                  P/L: ${formatNum(h.currentValue - h.amount * h.avgEntry)}
                </Text>
                <Text style={styles.expandedMeta}>24h: {h.change24h >= 0 ? '+' : ''}{h.change24h.toFixed(2)}%</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
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

      {walletAddress && (
        <Text style={[styles.walletAddress, { marginTop: spacing.xl }]}>
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
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
  totalChange: {
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: spacing.xs,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    padding: spacing.xl,
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
