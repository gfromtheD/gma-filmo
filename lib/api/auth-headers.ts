"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Cabeceras con la sesión actual (token y JSON) para llamar a las rutas `/api/*` desde el navegador. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" };
}
