/**
 * OrderCard — Rich UI card for trading orders in chat.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { useOrderStore } from '../../stores/orderStore';
import { useState } from 'react';

interface OrderCardProps {
  data: any;
}

export function OrderCreatedCard({ data }: OrderCardProps) {
  const order = data.order;
  if (!order) return null;

  const typeLabel =
    order.type === 'limit_buy' ? 'LIMIT BUY' :
    order.type === 'limit_sell' ? 'LIMIT SELL' : 'STOP LOSS';

  const typeColor =
    order.type === 'limit_buy' ? colors.green :
    order.type === 'limit_sell' ? colors.accent : colors.red;

  return (
    <View style={[styles.card, { borderLeftColor: typeColor }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{order.token}</Text>
        <Text style={[styles.cardBadge, { color: typeColor }]}>{typeLabel}</Text>
      </View>
      <Text style={styles.triggerText}>
        Trigger: ${formatNum(order.trigger_price)}
      </Text>
      <Text style={styles.metaText}>
        Amount: {order.amount} {order.type === 'limit_buy' ? order.base_token : order.token}
      </Text>
      {order.expires_hours && (
        <Text style={styles.metaText}>Expires in {order.expires_hours}h</Text>
      )}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
        <Text style={styles.statusText}>Active — watching price</Text>
      </View>
    </View>
  );
}

export function ViewOrdersCard({ orders }: { orders: any[] }) {
  const cancelOrderAction = useOrderStore((s) => s.cancelOrder);
  const [cancelling, setCancelling] = useState<string | null>(null);

  if (!orders || orders.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No active orders</Text>
      </View>
    );
  }

  const handleCancel = async (id: string) => {
    setCancelling(id);
    await cancelOrderAction(id);
    setCancelling(null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Active Orders</Text>
        <Text style={styles.cardBadge}>{orders.length}</Text>
      </View>
      {orders.map((order) => {
        const typeLabel =
          order.type === 'limit_buy' ? 'BUY' :
          order.type === 'limit_sell' ? 'SELL' : 'STOP';
        const typeColor =
          order.type === 'limit_buy' ? colors.green :
          order.type === 'limit_sell' ? colors.accent : colors.red;

        return (
          <View key={order.id} style={styles.orderRow}>
            <Text style={[styles.orderType, { color: typeColor }]}>{typeLabel}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderToken}>
                {order.token} @ ${formatNum(order.triggerPrice)}
              </Text>
              <Text style={styles.orderMeta}>
                {order.amount} {order.type === 'limit_buy' ? order.baseToken : order.token}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleCancel(order.id)}
              disabled={cancelling === order.id}
            >
              <Text style={styles.cancelText}>
                {cancelling === order.id ? '...' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

export function CancelOrderCard({ data }: OrderCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: colors.red }]}>
      <Text style={styles.cancelledText}>Order cancelled</Text>
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
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  triggerText: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: colors.green,
    fontSize: fontSize.xs,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderType: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    width: 36,
  },
  orderToken: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  orderMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  cancelText: {
    color: colors.red,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  cancelledText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontStyle: 'italic',
  },
});
