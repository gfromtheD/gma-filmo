import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_CONFIG_ERRORS } from "@/lib/constants/auth";
import type { Database } from "@/types/database";

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error(SUPABASE_CONFIG_ERRORS.missingPublicEnv);
  return createBrowserClient<Database>(url, key);
}
