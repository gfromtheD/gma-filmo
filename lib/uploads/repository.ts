import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UploadSession, MediaAsset, UploadDraft, UploadJob } from "./types";

export class UploadError extends Error {
  constructor(public readonly code: string, public readonly status = 409) {
    super(code);
    this.name = "UploadError";
  }
}

type Row = Record<string, unknown>;
type DatabaseFailure = { message?: string; code?: string } | null;

export function translateDatabaseError(error: DatabaseFailure): never {
  const code = error?.message?.match(/UPLOAD_[A-Z_]+/)?.[0];
  if (code) {
    const status = code === "UPLOAD_POLICY_UNAVAILABLE" ? 503 : code === "UPLOAD_NOT_FOUND" ? 404 : code === "UPLOAD_FORBIDDEN" ? 403
      : code === "UPLOAD_QUOTA_EXCEEDED" ? 413 : code === "UPLOAD_INVALID_INPUT" ? 400 : 409;
    throw new UploadError(code, status);
  }
  // Database failures must never turn into an empty quota or a permissive result.
  throw new UploadError("UPLOAD_DATABASE_UNAVAILABLE", 503);
}

export class UploadRepository {
  // Schema additions are deliberately independent from the generated legacy Database type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: any = getSupabaseAdminClient()) {}

  command<T>(owner: string, action: string, payload: Row): Promise<T> {
    return this.rpc('gma_upload_command', { p_owner: owner, p_action: action, p_payload: payload });
  }

  async rpc<T>(name: string, params: Row): Promise<T> {
    const { data, error } = await this.db.rpc(name, params);
    if (error) translateDatabaseError(error);
    if (data === null || data === undefined) throw new UploadError("UPLOAD_DATABASE_UNAVAILABLE", 503);
    if(Array.isArray(data)){if(data.length!==1)throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE',503);return data[0] as T;}
    return data as T;
  }

  async draft(ownerId: string, id: string): Promise<UploadDraft> {
    const { data, error } = await this.db.from("gma_upload_drafts").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (error) translateDatabaseError(error);
    if (!data) throw new UploadError("UPLOAD_NOT_FOUND", 404);
    return data as UploadDraft;
  }

  async drafts(ownerId: string): Promise<UploadDraft[]> {
    const { data, error } = await this.db.from("gma_upload_drafts").select("*").eq("owner_id", ownerId).eq("state", "draft").order("updated_at", { ascending: false }).limit(100);
    if (error) translateDatabaseError(error);
    return data as UploadDraft[];
  }

  async session(id: string, ownerId?: string): Promise<UploadSession> {
    let query = this.db.from("gma_upload_sessions").select("*").eq("id", id);
    if (ownerId) query = query.eq("owner_id", ownerId);
    const { data, error } = await query.maybeSingle();
    if (error) translateDatabaseError(error);
    if (!data) throw new UploadError("UPLOAD_NOT_FOUND", 404);
    return data as UploadSession;
  }

  async asset(id: string): Promise<MediaAsset> {
    const { data, error } = await this.db.from("gma_media_assets").select("*").eq("id", id).maybeSingle();
    if (error) translateDatabaseError(error);
    if (!data) throw new UploadError("UPLOAD_NOT_FOUND", 404);
    return data as MediaAsset;
  }

  async draftDetail(ownerId: string, id: string) {
    const draft = await this.draft(ownerId, id);
    const [{ data: sessions, error: sessionError }, { data: media, error: mediaError }] = await Promise.all([
      this.db.from("gma_upload_sessions").select("*").eq("draft_id", id).eq("owner_id", ownerId).order("created_at"),
      this.db.from("gma_draft_media").select("*").eq("draft_id", id),
    ]);
    if (sessionError) translateDatabaseError(sessionError);
    if (mediaError) translateDatabaseError(mediaError);
    const ids = Array.from(new Set((sessions as UploadSession[]).map(session => session.asset_id)));
    const assets: MediaAsset[] = [];
    for (const assetId of ids) assets.push(await this.asset(assetId));
    return { draft, sessions: sessions as UploadSession[], media: media as Row[], assets };
  }

  async assertCreator(ownerId: string): Promise<void> {
    const { data, error } = await this.db.from("creator_profiles").select("user_id").eq("user_id", ownerId).maybeSingle();
    if (error) translateDatabaseError(error);
    if (!data) throw new UploadError("UPLOAD_FORBIDDEN", 403);
  }

  async enqueue(kind: string, sessionId: string | null, payload: Row, key: string, runAfter = new Date().toISOString()): Promise<UploadJob> {
    return this.rpc("gma_upload_enqueue_job", { p_kind: kind, p_session_id: sessionId, p_payload: payload, p_dedupe_key: key, p_run_after: runAfter });
  }

  async claimSession(sessionId: string | null, kind: string | null, worker: string): Promise<UploadJob | null> {
    const { data, error } = await this.db.rpc("gma_upload_claim_session_job", { p_session_id: sessionId, p_kind: kind, p_worker: worker, p_lease_seconds: 120 });
    if (error) translateDatabaseError(error);
    const row=Array.isArray(data)?data[0]:data;
    return row?.id ? row as UploadJob : null;
  }

  async finishJob(jobId: string, worker: string, success: boolean, code?: string, retryAfter?: string): Promise<void> {
    await this.rpc("gma_upload_finish_job", { p_job_id: jobId, p_worker: worker, p_success: success, p_error: code ?? null, p_retry_after: retryAfter ?? null });
  }

  async findSessionByProviderRef(ref: string): Promise<UploadSession | null> {
    const { data, error } = await this.db.from("gma_upload_sessions").select("*").eq("provider", "stream").eq("provider_ref", ref).maybeSingle();
    if (error) translateDatabaseError(error);
    return data as UploadSession | null;
  }

  async reconciliationCandidates(limit = 30): Promise<UploadSession[]> {
    const { data, error } = await this.db.from("gma_upload_sessions").select("*").in("state", ["provisioning", "uploading", "paused", "uploaded", "cancelling", "failed"]).order("updated_at").limit(limit);
    if (error) translateDatabaseError(error);
    return data as UploadSession[];
  }

  async mayReadAsset(asset: MediaAsset, ownerId: string | null): Promise<boolean> {
    if (ownerId === asset.owner_id) return true;
    const { data, error } = await this.db.from("gma_title_media").select("title_id").eq("asset_id", asset.id);
    if (error) translateDatabaseError(error);
    const ids = (data as Array<{ title_id: number }>).map(row => row.title_id);
    if (ids.length) {
      const { data: titles, error: titleError } = await this.db.from("peliculas").select("id").in("id", ids).eq("status", "published").limit(1);
      if (titleError) translateDatabaseError(titleError);
      if (titles?.length) return true;
    }
    // Avatar delivery is public only after a real profile points to the normalized asset.
    if (asset.role === 'avatar' && asset.delivery_path) {
      const { data: profiles, error: profileError } = await this.db.from("creator_profiles").select("user_id").eq("user_id", asset.owner_id).eq("avatar_url", asset.delivery_path).limit(1);
      if (profileError) translateDatabaseError(profileError);
      if (profiles?.length) return true;
    }
    return false;
  }

  async scheduleReconciliation(): Promise<void> {
    await this.rpc<number>('gma_upload_schedule', {});
  }

  async pendingAccountDeletions():Promise<Array<{owner_id:string;state:string}>> {
    const {data,error}=await this.db.from('gma_upload_account_deletions').select('owner_id,state').neq('state','done').limit(5);
    if(error)translateDatabaseError(error);return data;
  }
  async accountCleanupComplete(owner:string) {
    const {count,error}=await this.db.from('gma_upload_sessions').select('id',{count:'exact',head:true}).eq('owner_id',owner).eq('quota_released',false);
    if(error)translateDatabaseError(error);return count===0;
  }
  async deleteAuthAccount(owner:string) {
    // Legacy account data has no provider reservations and is removed only after engine cleanup.
    for(const table of ['watchlist','view_history','ratings']) {
      const {error}=await this.db.from(table).delete().eq('user_id',owner);if(error)translateDatabaseError(error);
    }
    const {error:profileError}=await this.db.from('profiles').delete().eq('id',owner);if(profileError)translateDatabaseError(profileError);
    const {error}=await this.db.auth.admin.deleteUser(owner);
    if(error && error.status!==404)throw new UploadError('UPLOAD_ACCOUNT_DELETE_FAILED',503);
    const {error:updateError}=await this.db.from('gma_upload_account_deletions').update({state:'done'}).eq('owner_id',owner);
    if(updateError)translateDatabaseError(updateError);
  }
  async event(digest: string, uid: string) {
    return this.rpc<boolean>('gma_upload_event', {p_digest: digest, p_uid: uid});
  }
}
