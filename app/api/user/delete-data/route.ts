import { UploadRepository } from '@/lib/uploads/repository';
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

  // Keep auth and ownership intact until durable provider cleanup has completed.
  // A missing table is the pre-migration legacy deployment; all other DB failures fail closed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {error:engineError} = await (admin as any).from('gma_upload_account_deletions').select('owner_id').limit(1);
  if(engineError && engineError.code!=='42P01' && engineError.code!=='PGRST205')return NextResponse.json({error:'No se pudo comprobar la limpieza'},{status:503});
  if(!engineError){
    try{await new UploadRepository().command(userId,'delete_account',{});}
    catch{return NextResponse.json({error:'No se pudo iniciar la limpieza'},{status:503});}
    return NextResponse.json({ok:true,pending:true,message:'La cuenta se eliminará al confirmar la limpieza de sus archivos.'},{status:202});
  }
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
