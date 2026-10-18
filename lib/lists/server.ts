import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimitCheck } from "@/lib/api/rate-limit";

/** Holgado: organizar listas es uso normal; esto solo frena abusos. */
const LIMIT_PER_MINUTE = 120;

// Las tablas user_lists / user_list_items aún no están en types/database.ts (migración 20261022_user_lists).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const listsDb = () => getSupabaseAdminClient() as any;

export function jsonError(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}

/** Error con un mensaje pensado para mostrarlo tal cual al usuario (campo `message`). */
export function userError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message, message }, { status });
}

/** Usuario de la petición con límite de ritmo, o la respuesta de error lista para devolver. */
export async function authorize(request: Request, bucket: "read" | "write"): Promise<{ userId: string } | { response: NextResponse }> {
  const userId = await getUserId(request);
  if (!userId) return { response: jsonError(401, "Unauthorized") };
  const limit = rateLimitCheck(`${userId}/lists/${bucket}`, LIMIT_PER_MINUTE);
  if (!limit.allowed) return { response: jsonError(429, "Too many requests", { "Retry-After": String(limit.retryAfterSeconds) }) };
  return { userId };
}

/** La lista existe y es de este usuario. */
export async function ownsList(userId: string, listId: string): Promise<boolean> {
  const { data } = await listsDb().from("user_lists").select("id").eq("id", listId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
