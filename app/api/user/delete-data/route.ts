import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";

export async function DELETE(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${userId}/delete-account`, 3)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const admin = getSupabaseAdminClient();

  // Delete all user-generated data; collect errors before touching auth user
  const dataResults = await Promise.all([
    admin.from("watchlist").delete().eq("user_id", userId),
    admin.from("view_history").delete().eq("user_id", userId),
    admin.from("ratings").delete().eq("user_id", userId),
  ]);

  const dataError = dataResults.find((r) => r.error)?.error;
  if (dataError) {
    console.error("[api/user/delete-data] data deletion failed", dataError.message);
    return NextResponse.json({ ok: false, error: dataError.message }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) {
    console.error("[api/user/delete-data] profile deletion failed", profileError.message);
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[api/user/delete-data] auth deletion failed", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
