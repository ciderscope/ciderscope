import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont requis.");
    }
    _client = createClient(url, key);
  }
  return _client;
};

// Proxy object so existing `supabase.from(...)` calls still work
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getSupabase() as object, prop);
  },
});
