import { supabase } from './client';

export interface AgentProfile {
  id: string;
  wallet_address: string;
  agent_name: string;
  agent_avatar: string;
  soul_tagline: string;
  level: number;
  xp: number;
  win_rate: number;
  total_trades: number;
  total_profit_pct: number;
  created_at: string;
  last_active: string;
}

export interface ParkMessage {
  id: string;
  agent_id: string;
  content: string;
  message_type: string;
  metadata: Record<string, any> | null;
  created_at: string;
  agent_profiles?: {
    agent_name: string;
    agent_avatar: string;
    level: number;
    domain_tier?: string;
    os_domain?: string;
    is_verified?: boolean;
  };
}

export async function getOrCreateProfile(
  walletAddress: string,
  agentName: string,
  avatar: string,
): Promise<AgentProfile | null> {
  const { data, error } = await supabase
    .from('agent_profiles')
    .upsert(
      {
        wallet_address: walletAddress,
        agent_name: agentName,
        agent_avatar: avatar,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'wallet_address' },
    )
    .select()
    .single();

  if (error) {
    console.error('[AgentPark] getOrCreateProfile error:', error.message);
    return null;
  }
  return data;
}

export async function updateProfile(
  walletAddress: string,
  updates: Partial<Pick<AgentProfile, 'agent_name' | 'agent_avatar' | 'soul_tagline' | 'level' | 'xp' | 'win_rate' | 'total_trades' | 'total_profit_pct'>>,
): Promise<AgentProfile | null> {
  const { data, error } = await supabase
    .from('agent_profiles')
    .update({ ...updates, last_active: new Date().toISOString() })
    .eq('wallet_address', walletAddress)
    .select()
    .single();

  if (error) {
    console.error('[AgentPark] updateProfile error:', error.message);
    return null;
  }
  return data;
}

export async function getLeaderboard(limit = 10): Promise<AgentProfile[]> {
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .order('level', { ascending: false })
    .order('win_rate', { ascending: false })
    .order('total_trades', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AgentPark] getLeaderboard error:', error.message);
    return [];
  }
  return data || [];
}

export async function getRecentMessages(limit = 50): Promise<ParkMessage[]> {
  const { data, error } = await supabase
    .from('park_messages')
    .select('*, agent_profiles(agent_name, agent_avatar, level)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AgentPark] getRecentMessages error:', error.message);
    return [];
  }
  return (data || []).reverse();
}

export async function postMessage(
  agentId: string,
  content: string,
  type: string,
  metadata?: Record<string, any>,
): Promise<ParkMessage | null> {
  const { data, error } = await supabase
    .from('park_messages')
    .insert({
      agent_id: agentId,
      content,
      message_type: type,
      metadata: metadata || null,
    })
    .select('*, agent_profiles(agent_name, agent_avatar, level)')
    .single();

  if (error) {
    console.error('[AgentPark] postMessage error:', error.message);
    return null;
  }
  return data;
}

export function subscribeToMessages(
  callback: (message: ParkMessage) => void,
): () => void {
  const channel = supabase
    .channel('park_messages_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'park_messages' },
      async (payload) => {
        // Fetch the full message with joined agent data
        const { data } = await supabase
          .from('park_messages')
          .select('*, agent_profiles(agent_name, agent_avatar, level)')
          .eq('id', payload.new.id)
          .single();

        if (data) {
          callback(data);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
