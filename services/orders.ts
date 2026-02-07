/**
 * Order Service — Limit Orders, Stop Losses, and Auto-Execution
 *
 * Manages trading orders stored in AsyncStorage.
 * Orders are checked against live prices during heartbeat
 * and auto-executed via the swap service when triggered.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addXP } from './gamification';
import { sendLocalNotification } from './notifications';
import { getSwapQuote, executeSwap } from './swap';
import * as memory from './memory';

const ORDERS_KEY = '@openseeker/orders';

export type OrderType = 'limit_buy' | 'limit_sell' | 'stop_loss';
export type OrderStatus = 'active' | 'filled' | 'cancelled' | 'expired' | 'failed';

export interface TradingOrder {
  id: string;
  type: OrderType;
  token: string;         // e.g. "SOL", "WIF"
  amount: number;        // Amount to swap
  triggerPrice: number;  // Price that triggers execution
  baseToken: string;     // What to swap from/to (e.g. "USDC")
  status: OrderStatus;
  createdAt: number;
  expiresAt: number | null;  // null = no expiry
  filledAt: number | null;
  filledPrice: number | null;
  txSignature: string | null;
  error: string | null;
}

/**
 * Get all orders from storage.
 */
export async function getOrders(): Promise<TradingOrder[]> {
  const value = await AsyncStorage.getItem(ORDERS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

/**
 * Save orders to storage.
 */
async function saveOrders(orders: TradingOrder[]): Promise<void> {
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

/**
 * Get only active orders.
 */
export async function getActiveOrders(): Promise<TradingOrder[]> {
  const orders = await getOrders();
  return orders.filter((o) => o.status === 'active');
}

/**
 * Get filled orders (most recent first).
 */
export async function getFilledOrders(): Promise<TradingOrder[]> {
  const orders = await getOrders();
  return orders
    .filter((o) => o.status === 'filled')
    .sort((a, b) => (b.filledAt || 0) - (a.filledAt || 0));
}

/**
 * Create a new trading order.
 */
export async function createOrder(params: {
  type: OrderType;
  token: string;
  amount: number;
  triggerPrice: number;
  baseToken?: string;
  expiresInHours?: number;
}): Promise<TradingOrder> {
  const orders = await getOrders();
  const order: TradingOrder = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    type: params.type,
    token: params.token.toUpperCase(),
    amount: params.amount,
    triggerPrice: params.triggerPrice,
    baseToken: (params.baseToken || 'USDC').toUpperCase(),
    status: 'active',
    createdAt: Date.now(),
    expiresAt: params.expiresInHours
      ? Date.now() + params.expiresInHours * 60 * 60 * 1000
      : null,
    filledAt: null,
    filledPrice: null,
    txSignature: null,
    error: null,
  };
  orders.push(order);
  await saveOrders(orders);
  addXP(3).catch(console.error);

  console.log(`[Orders] Created ${order.type}: ${order.token} @ $${order.triggerPrice}`);
  return order;
}

/**
 * Cancel an order by ID.
 */
export async function cancelOrder(id: string): Promise<boolean> {
  const orders = await getOrders();
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== 'active') return false;
  order.status = 'cancelled';
  await saveOrders(orders);
  console.log(`[Orders] Cancelled: ${order.type} ${order.token}`);
  return true;
}

/**
 * Remove an order entirely (for cleanup).
 */
export async function removeOrder(id: string): Promise<void> {
  const orders = await getOrders();
  await saveOrders(orders.filter((o) => o.id !== id));
}

/**
 * Check if a price triggers an order.
 * - limit_buy: triggers when price drops to or below triggerPrice
 * - limit_sell: triggers when price rises to or above triggerPrice
 * - stop_loss: triggers when price drops to or below triggerPrice
 */
function shouldTrigger(order: TradingOrder, currentPrice: number): boolean {
  switch (order.type) {
    case 'limit_buy':
      return currentPrice <= order.triggerPrice;
    case 'limit_sell':
      return currentPrice >= order.triggerPrice;
    case 'stop_loss':
      return currentPrice <= order.triggerPrice;
    default:
      return false;
  }
}

/**
 * Execute a triggered order via the swap service.
 */
async function executeOrder(order: TradingOrder, currentPrice: number): Promise<void> {
  const orders = await getOrders();
  const target = orders.find((o) => o.id === order.id);
  if (!target || target.status !== 'active') return;

  console.log(`[Orders] Executing ${order.type}: ${order.amount} ${order.token} @ $${currentPrice}`);

  try {
    // Determine swap direction
    let fromSymbol: string;
    let toSymbol: string;
    let amount: number;

    if (order.type === 'limit_buy') {
      // Buy token with base (e.g. buy SOL with USDC)
      fromSymbol = order.baseToken;
      toSymbol = order.token;
      amount = order.amount; // amount of base to spend
    } else {
      // Sell token for base (limit_sell, stop_loss)
      fromSymbol = order.token;
      toSymbol = order.baseToken;
      amount = order.amount; // amount of token to sell
    }

    // Get quote
    const quote = await getSwapQuote(fromSymbol, toSymbol, amount);

    // Execute swap
    const result = await executeSwap({
      from: quote.from,
      to: quote.to,
      rawQuote: quote.rawQuote,
      source: 'order',
    });

    // Mark as filled
    target.status = 'filled';
    target.filledAt = Date.now();
    target.filledPrice = currentPrice;
    target.txSignature = result.txSignature;
    await saveOrders(orders);

    // Notify
    const typeLabel = order.type === 'limit_buy' ? 'Limit Buy' :
                      order.type === 'limit_sell' ? 'Limit Sell' : 'Stop Loss';
    await sendLocalNotification(
      `Order Filled: ${typeLabel}`,
      `${order.token} ${order.type === 'limit_buy' ? 'bought' : 'sold'} at $${currentPrice.toFixed(2)}`,
      { type: 'order_filled', orderId: order.id },
    );

    // Log to daily
    await memory.appendDaily(
      `[ORDER] ${typeLabel} filled: ${order.amount} ${order.token} @ $${currentPrice.toFixed(2)} (tx: ${result.txSignature.slice(0, 8)}...)`,
    );

    addXP(10).catch(console.error);
    console.log(`[Orders] Filled: ${order.type} ${order.token} tx=${result.txSignature.slice(0, 8)}...`);
  } catch (err: any) {
    console.error(`[Orders] Execution failed for ${order.id}:`, err.message);
    target.status = 'failed';
    target.error = err.message;
    await saveOrders(orders);

    await sendLocalNotification(
      'Order Failed',
      `${order.type} ${order.token}: ${err.message}`,
      { type: 'order_failed', orderId: order.id },
    );
  }
}

/**
 * Check all active orders against current prices.
 * Called by heartbeat and priceWatcher.
 *
 * @param prices - Map of symbol to current price (e.g. { SOL: 180, WIF: 2.5 })
 * @returns Array of orders that were triggered
 */
export async function checkOrders(
  prices: Record<string, number>,
): Promise<TradingOrder[]> {
  const orders = await getOrders();
  const now = Date.now();
  const triggered: TradingOrder[] = [];

  for (const order of orders) {
    if (order.status !== 'active') continue;

    // Check expiry
    if (order.expiresAt && order.expiresAt <= now) {
      order.status = 'expired';
      await sendLocalNotification(
        'Order Expired',
        `${order.type} ${order.token} @ $${order.triggerPrice} has expired`,
        { type: 'order_expired', orderId: order.id },
      );
      continue;
    }

    // Check price trigger
    const currentPrice = prices[order.token];
    if (currentPrice == null) continue;

    if (shouldTrigger(order, currentPrice)) {
      triggered.push(order);
      // Execute asynchronously (don't block other order checks)
      executeOrder(order, currentPrice).catch(console.error);
    }
  }

  // Save any expired orders
  await saveOrders(orders);
  return triggered;
}

/**
 * Get a summary of active orders (for display).
 */
export async function getOrdersSummary(): Promise<{
  active: number;
  filled: number;
  orders: TradingOrder[];
}> {
  const orders = await getOrders();
  return {
    active: orders.filter((o) => o.status === 'active').length,
    filled: orders.filter((o) => o.status === 'filled').length,
    orders,
  };
}
