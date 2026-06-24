import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AnyTextFunctionsClient, AnyTextRealtimeClient, AnyTextRpcClient, AnyTextStorageClient } from './supabaseRelay';

let cachedClient: SupabaseClient | null = null;
type AnyTextSupabaseClient = AnyTextRpcClient & AnyTextRealtimeClient & AnyTextStorageClient & AnyTextFunctionsClient;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY &&
      import.meta.env.VITE_SUPABASE_ANON_KEY !== 'replace_me',
  );
}

export function getSupabaseClient(): AnyTextSupabaseClient {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  cachedClient ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

  return cachedClient as unknown as AnyTextSupabaseClient;
}
