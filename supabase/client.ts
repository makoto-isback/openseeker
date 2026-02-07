import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// Convenience alias — returns null when env vars missing instead of crashing
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      // Return no-op functions for .from(), .channel(), etc.
      if (prop === 'from' || prop === 'channel') {
        return () => new Proxy({}, { get: () => () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) });
      }
      if (prop === 'removeChannel') {
        return () => {};
      }
      return undefined;
    }
    return (client as any)[prop];
  },
});
