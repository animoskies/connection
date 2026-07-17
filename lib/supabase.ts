import { SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

declare global {
  var connectionSupabase: SupabaseClient | undefined;
}

export function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  if (!globalThis.connectionSupabase) {
    globalThis.connectionSupabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  return globalThis.connectionSupabase;
}
