import { useSettingsStore } from '../stores/settingsStore';
import { paidFetch } from './x402';

interface ChatPayload {
  message: string;
  soul: string;
  memory: string;
  context: string;
  wallet: string;
  history: Array<{ role: string; content: string }>;
  agent_name?: string;
  park_context?: string;
  park_mode?: string;
}

interface ChatResponse {
  response: string;
  skill_results?: Array<{ skill: string; success: boolean; data?: any; error?: string }>;
  skills_needed?: string[];
}

export async function sendMessage(payload: ChatPayload): Promise<ChatResponse> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  // Log what memory is being sent to the server
  console.log('[API] sendMessage — Memory sent to server:');
  console.log(`  - soul: ${payload.soul.length} chars`);
  console.log(`  - memory: ${payload.memory.length} chars`);
  console.log(`  - context: ${payload.context.length} chars`);
  console.log(`  - wallet: ${payload.wallet.length} chars`);
  console.log(`  - history: ${payload.history.length} messages`);
  console.log(`  - message: "${payload.message.slice(0, 80)}..."`);

  const res = await paidFetch(
    `${serverUrl}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    15000,
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Server error: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[API] sendMessage — Response received: ${data.response?.length || 0} chars`);
  if ((data as any).skill_results) {
    console.log(`[API] sendMessage — Skill results: ${JSON.stringify((data as any).skill_results.map((s: any) => s.skill))}`);
  }
  return data;
}

// --- Heartbeat ---

export interface HeartbeatPayload {
  soul: string;
  memory: string;
  wallet: string;
  watched_tokens: string[];
  alerts: Array<{ token: string; condition: string; price: number }>;
  portfolio_tokens: Array<{ symbol: string; amount: number; avg_entry: number }>;
}

export interface HeartbeatResponse {
  status: string;
  notify: boolean;
  message?: string;
  triggers?: string[];
  timestamp: string;
  portfolio_value?: number;
  portfolio_change?: number;
  prices?: Record<string, { price: number; change_24h: number }>;
  triggered_alerts?: Array<{ token: string; condition: string; price: number; current_price: number }>;
}

export async function heartbeat(payload: HeartbeatPayload): Promise<HeartbeatResponse> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  const res = await paidFetch(
    `${serverUrl}/heartbeat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    30000,
  );

  if (!res.ok) {
    throw new Error(`Heartbeat failed: ${res.status}`);
  }

  return await res.json();
}

// --- Briefing ---

export interface BriefingPayload {
  type: 'morning' | 'night';
  soul: string;
  memory: string;
  wallet: string;
  daily_log?: string;
  watched_tokens: string[];
  portfolio_tokens: Array<{ symbol: string; amount: number; avg_entry: number }>;
}

export interface BriefingResponse {
  type: string;
  response: string;
  portfolio_value: number;
  timestamp: string;
}

export async function briefing(payload: BriefingPayload): Promise<BriefingResponse> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  const res = await paidFetch(
    `${serverUrl}/briefing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    30000,
  );

  if (!res.ok) {
    throw new Error(`Briefing failed: ${res.status}`);
  }

  return await res.json();
}

// --- Swap ---

export interface SwapQuoteResponse {
  success: boolean;
  quote: {
    from: { symbol: string; amount: number };
    to: { symbol: string; amount: number };
    rate: number;
    price_impact: number;
    min_received: number;
    slippage: string;
    route: string;
    source: string;
  };
  rawResponse?: any;
}

export async function getSwapQuote(from: string, to: string, amount: number): Promise<SwapQuoteResponse> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  const res = await paidFetch(
    `${serverUrl}/swap/swap-quote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, amount }),
    },
    15000,
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Swap quote failed: ${res.status}`);
  }

  return await res.json();
}

export async function executeSwapTx(quoteResponse: any, userPublicKey: string): Promise<any> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  const res = await paidFetch(
    `${serverUrl}/swap/swap-execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse, userPublicKey }),
    },
    30000,
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Swap execute failed: ${res.status}`);
  }

  return await res.json();
}

// --- Park ---

export interface ParkGeneratePayload {
  soul: string;
  memory: string;
  wallet: string;
  park_context: string;
  prompt_type: string;
}

export interface ParkGenerateResponse {
  content: string;
  prompt_type: string;
}

export async function generateParkPost(payload: ParkGeneratePayload): Promise<ParkGenerateResponse> {
  const serverUrl = useSettingsStore.getState().serverUrl;

  const res = await paidFetch(
    `${serverUrl}/park/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    15000,
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Park generate failed: ${res.status}`);
  }

  return await res.json();
}

// --- Health ---

export async function checkHealth(): Promise<boolean> {
  const serverUrl = useSettingsStore.getState().serverUrl;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${serverUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
