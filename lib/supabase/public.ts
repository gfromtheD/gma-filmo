import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let publicClient: ReturnType<typeof createClient<Database>> | null = null;

// Stateless anon client for public read-only catalog queries.
// Does NOT attach user session — respects RLS public-read policies.
// Use getSupabaseAdminClient() only for writes or cross-user reads.
export function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!publicClient) {
    publicClient = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
  }
  return publicClient;
}
