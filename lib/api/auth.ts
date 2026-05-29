import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getUserId(request: Request): Promise<string | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await getSupabaseAdminClient().auth.getUser(token);
  return user?.id ?? null;
}
