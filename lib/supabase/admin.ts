import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIG_ERRORS } from "@/lib/constants/auth";
import type { Database } from "@/types/database";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(SUPABASE_CONFIG_ERRORS.missingServerEnv);
  if (!adminClient) {
    adminClient = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}
