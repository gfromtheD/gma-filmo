import { respond } from '@/lib/uploads/http';
import { UploadRepository } from '@/lib/uploads/repository';
import { metadataSchema,revisionSchema } from '@/lib/uploads/contracts';
import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getUserId } from "@/lib/api/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { slug } = params;
  const supabase = getSupabaseAdminClient();

  // Verify ownership before deleting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: findErr } = await (supabase as any)
    .from("peliculas")
    .select("id, creator_user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (findErr || !row) {
    return NextResponse.json({ error: "Título no encontrado" }, { status: 404 });
  }
  if ((row as { creator_user_id: string | null }).creator_user_id !== userId) {
    return NextResponse.json({ error: "No tienes permiso para eliminar este título" }, { status: 403 });
  }

  // Engine tables are detected from the record, so rollback still retires Stream titles safely.
  const {data:full}=await supabase.from('peliculas').select('*').eq('slug',slug).maybeSingle();
  // A legacy title may already have a replacement draft referencing it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {data:enginePolicy,error:enginePolicyError}=await (supabase as any).from('gma_upload_policy').select('id').maybeSingle();
  if(enginePolicyError && !['42P01','PGRST205'].includes(enginePolicyError.code))return NextResponse.json({error:'UPLOAD_DATABASE_UNAVAILABLE'},{status:503});
  if(!enginePolicy && !enginePolicyError)return NextResponse.json({error:'UPLOAD_POLICY_UNAVAILABLE'},{status:503});
  if(enginePolicy || (full as unknown as {playback_kind?:string})?.playback_kind==='stream')return respond(async()=>{
    const result=await new UploadRepository().command(userId,'retire',{slug});revalidateTag('peliculas');return result;
  });
  const { error: delErr } = await supabase.from("peliculas").delete().eq("slug", slug);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  revalidateTag("peliculas");

  return NextResponse.json({ ok: true });
}

export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:{slug:string}}){return respond(async()=>{
 const user=await getUserId(req);if(!user)throw new (await import('@/lib/uploads/repository')).UploadError('UPLOAD_UNAUTHORIZED',401);
 const {data,error}=await getSupabaseAdminClient().from('peliculas').select('*').eq('slug',params.slug).eq('creator_user_id',user).maybeSingle();
 if(error||!data)throw new (await import('@/lib/uploads/repository')).UploadError('UPLOAD_NOT_FOUND',404);
 return {title:data};
});}
export async function PATCH(req:NextRequest,{params}:{params:{slug:string}}){return respond(async()=>{
 const user=await getUserId(req);if(!user)throw new (await import('@/lib/uploads/repository')).UploadError('UPLOAD_UNAUTHORIZED',401);
 const raw=await req.text();if(raw.length>24000)throw new (await import('@/lib/uploads/repository')).UploadError('UPLOAD_INVALID_INPUT',400);
 const input=z.object({revision:revisionSchema,metadata:metadataSchema}).strict().parse(JSON.parse(raw));
 const title=await new UploadRepository().command(user,'edit_title',{...input,slug:params.slug});revalidateTag('peliculas');return {title};
});}
