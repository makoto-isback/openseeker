/**
 * Order Store — Zustand state for trading orders.
 */
import { create } from 'zustand';
import {
  getOrders,
  getActiveOrders,
  createOrder,
  cancelOrder,
  removeOrder,
  type TradingOrder,
  type OrderType,
} from '../services/orders';
import { ensureWatching } from '../services/priceWatcher';

interface OrderState {
  orders: TradingOrder[];
  activeCount: number;
  isLoading: boolean;

  loadOrders: () => Promise<void>;
  placeOrder: (params: {
    type: OrderType;
    token: string;
    amount: number;
    triggerPrice: number;
    baseToken?: string;
    expiresInHours?: number;
  }) => Promise<TradingOrder>;
  cancelOrder: (id: string) => Promise<boolean>;
  removeOrder: (id: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  activeCount: 0,
  isLoading: false,

  loadOrders: async () => {
    const orders = await getOrders();
    const active = orders.filter((o) => o.status === 'active');
    set({ orders, activeCount: active.length });

    // Start price watcher if there are active orders
    if (active.length > 0) {
      ensureWatching().catch(console.error);
    }
  },

  placeOrder: async (params) => {
    const order = await createOrder(params);
    await get().loadOrders();
    // Start watching prices
    ensureWatching().catch(console.error);
    return order;
  },

  cancelOrder: async (id: string) => {
    const result = await cancelOrder(id);
    await get().loadOrders();
    return result;
  },

  removeOrder: async (id: string) => {
    await removeOrder(id);
    await get().loadOrders();
  },
}));
