import { create } from 'zustand';
import { Message, readMessages, saveMessages } from '../services/memory';
import { sendMessage as apiSendMessage } from '../services/api';
import { useMemoryStore } from './memoryStore';
import { processResponse } from '../services/memoryEngine';
import { addAlert } from '../services/alerts';
import { addDCAConfig } from '../services/dca';
import { addXP } from '../services/gamification';
import { createOrder, getActiveOrders, cancelOrder as cancelOrderService } from '../services/orders';
import { ensureWatching } from '../services/priceWatcher';
import { useSettingsStore } from './settingsStore';
import { addWatchedWallet, removeWatchedWallet } from '../services/whaleCopyTrade';
import { getAlerts, removeAlert } from '../services/alerts';

interface ChatState {
  messages: Message[];
  isSending: boolean;
  isLoading: boolean;
  messageCount: number;
  loadMessages: () => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string, skillResults?: Message['skillResults']) => Promise<Message>;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isSending: false,
  isLoading: false,
  messageCount: 0,

  loadMessages: async () => {
    const messages = await readMessages();
    set({ messages, messageCount: messages.length });
  },

  addMessage: async (role, content, skillResults) => {
    const message: Message = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
      role,
      content,
      timestamp: Date.now(),
      skillResults,
    };
    const messages = [...get().messages, message];
    set({ messages });
    await saveMessages(messages);
    return message;
  },

  sendMessage: async (text: string) => {
    const { addMessage } = get();

    // 1. Add user message
    await addMessage('user', text);

    // 2. Set loading state
    set({ isLoading: true, isSending: true });

    try {
      // 3. Gather context from memory store
      const memStore = useMemoryStore.getState();
      const { soul, userMemory, wallet } = memStore;
      const { getContext } = await import('../services/memory');
      const context = await getContext();

      // 4. Get last 10 messages for conversation history
      const allMessages = get().messages;
      const history = allMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 5. Call API with agent name and park context
      const { agentName, parkMode } = useSettingsStore.getState();
      let parkContext = '';
      try {
        const { getRecentMessages } = await import('../supabase/agentPark');
        const parkMsgs = await getRecentMessages(20);
        parkContext = parkMsgs
          .slice(-10)
          .map((m: any) => `${m.agent_profiles?.agent_name || 'Unknown'}: ${m.content}`)
          .join('\n');
      } catch {}

      const result = await apiSendMessage({
        message: text,
        soul,
        memory: userMemory,
        context,
        wallet,
        history,
        agent_name: agentName,
        park_context: parkContext,
        park_mode: parkMode,
      });

      // 6. Add AI response with skill results
      await addMessage('assistant', result.response, result.skill_results);

      // 7. Handle skill side-effects (e.g. save price alerts)
      if (result.skill_results) {
        for (const sr of result.skill_results) {
          if (sr.success && sr.skill === 'price_alert' && sr.data?.alert) {
            const a = sr.data.alert;
            await addAlert(a.token, a.condition, a.target_price);
          }
          if (sr.success && sr.skill === 'dca_setup' && sr.data?.action === 'create_dca') {
            const d = sr.data;
            await addDCAConfig(d.from_token, d.to_token, d.amount, d.interval_hours);
          }
          // Handle order creation (limit_buy, limit_sell, stop_loss)
          if (sr.success && sr.data?.action === 'create_order' && sr.data?.order) {
            const o = sr.data.order;
            if (o.type && o.token && o.amount && o.trigger_price) {
              await createOrder({
                type: o.type,
                token: o.token,
                amount: o.amount,
                triggerPrice: o.trigger_price,
                baseToken: o.base_token || 'USDC',
                expiresInHours: o.expires_hours || undefined,
              });
            } else {
              console.warn('[CHAT_STORE] Skipped order creation — missing required fields:', o);
            }
            ensureWatching().catch(console.error);
          }
          // Handle view_orders — inject active orders into data
          if (sr.success && sr.skill === 'view_orders') {
            const activeOrders = await getActiveOrders();
            sr.data = { ...sr.data, orders: activeOrders };
          }
          // Handle cancel_order
          if (sr.success && sr.skill === 'cancel_order' && sr.data?.order_id) {
            await cancelOrderService(sr.data.order_id);
          }
          // Handle whale_track — save to watched wallets
          if (sr.success && sr.skill === 'whale_track' && sr.data?.wallet) {
            await addWatchedWallet(sr.data.wallet, sr.data.label);
          }
          // Handle whale_stop — remove from watched wallets
          if (sr.success && sr.skill === 'whale_stop' && sr.data?.wallet) {
            await removeWatchedWallet(sr.data.wallet);
          }
          // Handle view_alerts — inject active alerts into data
          if (sr.success && sr.skill === 'view_alerts') {
            const activeAlerts = await getAlerts();
            sr.data = { ...sr.data, alerts: activeAlerts.filter((a: any) => !a.triggered) };
          }
          // Handle cancel_alert
          if (sr.success && sr.skill === 'cancel_alert' && sr.data?.alert_id) {
            await removeAlert(sr.data.alert_id);
          }
        }
      }

      // 8. Run memory engine + XP
      set({ messageCount: get().messageCount + 2 });
      console.log('[CHAT_STORE] Running processResponse for memory extraction...');
      console.log(`[CHAT_STORE] User message: "${text.slice(0, 80)}..."`);
      console.log(`[CHAT_STORE] AI response: "${result.response.slice(0, 80)}..."`);
      processResponse(text, result.response)
        .then(() => console.log('[CHAT_STORE] processResponse completed successfully'))
        .catch((err) => console.error('[CHAT_STORE] processResponse failed:', err));
      addXP(1).catch(console.error);
    } catch (error: any) {
      let errorMsg = 'Something went wrong. Please try again.';
      const msg = error.message || '';
      if (msg.includes('abort') || msg.includes('timeout')) {
        errorMsg = 'Request timed out. Check your connection and try again.';
      } else if (msg.includes('Insufficient balance')) {
        errorMsg = 'Insufficient credits. Add credits in Settings > Credits to continue.';
      } else if (msg.includes('Payment required') || msg.includes('402')) {
        errorMsg = 'Payment required. Add credits in Settings to use this feature.';
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to')) {
        errorMsg = 'Cannot reach server. Check Settings > Server URL.';
      } else if (msg.includes('spend') || msg.includes('limit')) {
        errorMsg = 'Daily spend limit reached. Increase it in Settings.';
      } else if (msg.includes('429') || msg.includes('rate')) {
        errorMsg = 'Too many requests. Try again in a moment.';
      }
      await addMessage('assistant', errorMsg);
    } finally {
      set({ isLoading: false, isSending: false });
    }
  },

  clearMessages: async () => {
    set({ messages: [], messageCount: 0 });
    await saveMessages([]);
  },
}));
