import { z } from 'zod';
import type { JsonObject, MediaAssetRow, UploadSessionRow, UploadDraftRow, UploadJobRow } from '@/types/media-engine';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { parseMediaAssetRow, parseUploadSessionRow } from './dto';
import { UploadError, translateDatabaseError } from '@/lib/uploads/repository';

export type MediaCommand = 'bind_upload' | 'queue_verification' | 'receipt' | 'processing' | 'ready' | 'failed' | 'retry' | 'authorize_transfer' | 'delete_confirmed';
export type TitleCommand = 'edit' | 'unpublish' | 'republish' | 'delete' | 'retire';

/** Narrow RPC seam; callers cannot issue arbitrary SQL or access provider-private rows directly. */
export interface MediaRepositoryClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
  from(table: 'gma_media_provider_private'): {
    select(columns: '*'): { eq(column: 'session_id', value: string): { maybeSingle(): Promise<{ data: unknown; error: { message?: string; code?: string } | null }> } };
  };
}

const privateStateSchema = z.object({
  session_id: z.string().uuid(), asset_id: z.string().uuid(), provider: z.enum(['r2','stream','mock','peertube']),
  upload_id: z.string().nullable(), private_state: z.record(z.string(), z.unknown()), updated_at: z.string(),
}).strict();
const transferClaimSchema = z.object({ fence: z.number().int().positive(), leaseUntil: z.string().datetime({ offset: true }), offset: z.number().int().nonnegative() }).strict();
const playbackAuthorizationSchema = z.object({
  id: z.string().uuid(), owner_id: z.string().uuid(), provider: z.enum(['r2','stream','mock','peertube']),
  role: z.string(), state: z.literal('ready'), duration_seconds: z.number().nonnegative().nullable(),
  expected_input_bytes: z.number().int().positive(), received_bytes: z.number().int().nonnegative().nullable(),
  delivery_path: z.string().nullable(), verified_at: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
}).strict();

export class MediaRepository {
  constructor(private readonly db: MediaRepositoryClient = getSupabaseAdminClient() as unknown as MediaRepositoryClient) {}

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.db.rpc(name, args);
    if (error) translateDatabaseError(error);
    if (data === null || data === undefined) throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE', 503);
    return data;
  }

  async command(ownerId: string, action: MediaCommand, payload: JsonObject): Promise<unknown> {
    return this.call('gma_media_command', { p_owner: ownerId, p_action: action, p_payload: payload });
  }

  async claimTransfer(ownerId: string, sessionId: string, generation: number, writer: string): Promise<z.infer<typeof transferClaimSchema>> {
    return transferClaimSchema.parse(await this.call('gma_media_transfer_claim', {
      p_owner: ownerId, p_session_id: sessionId, p_generation: generation, p_writer: writer,
    }));
  }

  async commitChunk(ownerId: string, input: {
    sessionId: string; generation: number; writer: string; fence: number;
    startByte: number; endByte: number; sha256: string; storageRelative: string; upstreamConfirmed: boolean;
  }): Promise<unknown> {
    return this.call('gma_media_transfer_commit', {
      p_owner: ownerId, p_session_id: input.sessionId, p_generation: input.generation,
      p_writer: input.writer, p_fence: input.fence, p_start_byte: input.startByte, p_end_byte: input.endByte,
      p_sha256: input.sha256, p_storage_relative: input.storageRelative, p_upstream_confirmed: input.upstreamConfirmed,
    });
  }

  async renewTransfer(owner: string, id: string, generation: number, writer: string, fence: number): Promise<void> {
    await this.call('gma_media_transfer_renew', { p_owner:owner,p_session_id:id,p_generation:generation,p_writer:writer,p_fence:fence });
  }
  async releaseTransfer(owner: string, id: string, generation: number, writer: string, fence: number): Promise<void> {
    await this.call('gma_media_transfer_release', { p_owner:owner,p_session_id:id,p_generation:generation,p_writer:writer,p_fence:fence });
  }
  async gatewayState(owner:string,id:string,generation:number,writer:string,fence:number,patch:JsonObject,providerMediaId:string|null=null):Promise<void>{
    await this.call('gma_media_gateway_state',{p_owner:owner,p_session_id:id,p_generation:generation,p_writer:writer,p_fence:fence,p_patch:patch,p_provider_media_id:providerMediaId});
  }
  async transferChunks(id:string,generation:number){
    return z.array(z.object({start_byte:z.number().int().nonnegative(),end_byte:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/),storage_relative:z.string(),upstream_confirmed:z.boolean(),writer_fence:z.number().int().positive()}))
      .parse(await this.result(this.query('gma_media_upload_chunks').select('start_byte,end_byte,sha256,storage_relative,upstream_confirmed,writer_fence').eq('session_id',id).eq('generation',generation).order('start_byte')));
  }

  async privateState(sessionId: string): Promise<JsonObject> {
    const { data, error } = await this.db.from('gma_media_provider_private').select('*').eq('session_id', sessionId).maybeSingle();
    if (error) translateDatabaseError(error);
    if (!data) throw new UploadError('UPLOAD_NOT_FOUND', 404);
    const row = privateStateSchema.parse(data);
    return row.private_state as JsonObject;
  }

  async authorizePlayback(mediaId: string, ownerId: string | null, titleSlug: string | null = null): Promise<unknown> {
    return playbackAuthorizationSchema.parse(await this.call('gma_media_authorize', {
      p_asset_id: mediaId, p_owner: ownerId, p_title_slug: titleSlug,
    }));
  }

  async authorizedOutput(id:string,relative:string,owner:string|null) {
    return z.object({key:z.string(),mimeType:z.string().nullable(),sizeBytes:z.number().int().positive().nullable()}).parse(await this.call('gma_media_output_authorized',{p_asset_id:id,p_relative:relative,p_owner:owner,p_title_slug:null}));
  }
  async registerGatewayGrant(owner:string|null,assetId:string,generation:number,draftId:string|null,titleSlug:string|null,tokenHash:string,expiresAt:string):Promise<void>{
    await this.call('gma_media_gateway_grant',{p_owner:owner,p_asset_id:assetId,p_generation:generation,p_draft_id:draftId,p_title_slug:titleSlug,p_token_hash:tokenHash,p_expires_at:expiresAt});
  }
  /** Autoriza la entrega HLS de un activo de PeerTube por la pasarela (migración 20261021000200). */
  async peerTubeAccess(assetId:string,generation:number,tokenHash:string){
    return z.object({provider:z.literal('peertube'),provider_ref:z.string().uuid(),expected_input_bytes:z.number().int().positive()})
      .parse(await this.call('gma_media_gateway_peertube_access',{p_asset_id:assetId,p_generation:generation,p_token_hash:tokenHash}));
  }
  async gatewayOutput(assetId:string,generation:number,relative:string,tokenHash:string){
    return z.object({key:z.string(),mimeType:z.string(),sizeBytes:z.number().int().positive(),provider:z.enum(['mock','peertube','r2','stream'])})
      .parse(await this.call('gma_media_gateway_output',{p_asset_id:assetId,p_generation:generation,p_relative:relative,p_token_hash:tokenHash}));
  }
  async confirmedOffset(id:string,generation:number):Promise<number> {
    const rows=z.array(z.object({end_byte:z.number().int().nonnegative(),upstream_confirmed:z.boolean()})).parse(await this.result(this.query('gma_media_upload_chunks').select('end_byte,upstream_confirmed').eq('session_id',id).eq('generation',generation)));
    return rows.reduce((max,row)=>row.upstream_confirmed?Math.max(max,row.end_byte+1):max,0);
  }
  async titleCommand(ownerId: string, action: TitleCommand, payload: JsonObject): Promise<unknown> {
    return this.call('gma_title_command', { p_owner: ownerId, p_action: action, p_payload: payload });
  }

  async restoreTitleVersion(ownerId: string, titleId: number, expectedRevision: number, restoreRevision: number, idempotencyKey: string): Promise<unknown> {
    return this.call('gma_title_restore_version', {
      p_owner: ownerId, p_title_id: titleId, p_expected_revision: expectedRevision,
      p_restore_revision: restoreRevision, p_idempotency_key: idempotencyKey,
    });
  }

  private query(table: string): MediaReadQuery { return (this.db as unknown as MediaReadClient).from(table); }
  private async result(query: PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>): Promise<unknown> {
    const { data, error } = await query; if (error) translateDatabaseError(error); return data;
  }
  async title(slug:string,owner?:string): Promise<Record<string,unknown>> {
    let query=this.query('peliculas').select('*').eq('slug',slug);if(owner)query=query.eq('creator_user_id',owner);
    const data=await this.result(query.maybeSingle());if(!data)throw new UploadError('UPLOAD_NOT_FOUND',404);
    return z.record(z.string(),z.unknown()).parse(data);
  }
  async draftContains(draft:string,asset:string):Promise<boolean>{return Boolean(await this.result(this.query('gma_draft_media').select('asset_id').eq('draft_id',draft).eq('asset_id',asset).maybeSingle()));}
  async titleMedia(id:number):Promise<Array<{asset_id:string;role:string;slot:string;language:string|null;position:number}>> {
    return z.array(z.object({asset_id:z.string().uuid(),role:z.string(),slot:z.string(),language:z.string().nullable(),position:z.number().int()})).parse(await this.result(this.query('gma_title_media').select('asset_id,role,slot,language,position').eq('title_id',id).order('position')));
  }
  /** ¿El archivo pertenece a un título publicado y vivo? Entonces es público y su entrega se puede cachear. */
  async isPublishedTitleAsset(asset:string):Promise<boolean> {
    const rows=z.array(z.object({title_id:z.number().int()})).parse(await this.result(this.query('gma_title_media').select('title_id').eq('asset_id',asset).limit(1)));
    if(!rows[0])return false;
    const title=z.object({status:z.string().nullable(),media_delete_state:z.string().nullable()}).nullable()
      .parse(await this.result(this.query('peliculas').select('status,media_delete_state').eq('id',rows[0].title_id).maybeSingle()));
    return title?.status==='published' && (title.media_delete_state??'none')==='none';
  }
  async titleVersions(id:number,owner:string):Promise<Array<{revision:number;owner_id:string;retained_until:string;snapshot:Record<string,unknown>}>> {
    return z.array(z.object({revision:z.number().int().nonnegative(),owner_id:z.string().uuid(),retained_until:z.string().datetime({offset:true}),snapshot:z.record(z.string(),z.unknown())}))
      .parse(await this.result(this.query('gma_title_media_versions').select('revision,owner_id,retained_until,snapshot').eq('title_id',id).eq('owner_id',owner).order('revision').limit(16)));
  }
  async reserve(owner:string,payload:JsonObject) {
    const result=z.object({created:z.boolean(),session:z.unknown()}).parse(await this.call('gma_media_reserve_result',{p_owner:owner,p_payload:payload}));
    return {created:result.created,session:this.parseSession(result.session)};
  }
  async lookupReservation(owner: string, key: string): Promise<UploadSessionRow | null> {
    const data = await this.result(this.query('gma_upload_sessions').select('*').eq('owner_id', owner).eq('idempotency_key', key).maybeSingle());
    return data ? this.parseSession(data) : null;
  }
  async session(id: string, owner?: string): Promise<UploadSessionRow> {
    let query = this.query('gma_upload_sessions').select('*').eq('id', id); if (owner) query = query.eq('owner_id', owner);
    const data = await this.result(query.maybeSingle()); if (!data) throw new UploadError('UPLOAD_NOT_FOUND', 404); return this.parseSession(data);
  }
  async asset(id: string,metadata=true): Promise<MediaAssetRow> {
    const data = await this.result(this.query('gma_media_assets').select(metadata?'*':'id,owner_id,role,provider,provider_ref,state,expected_input_bytes,received_bytes,provider_reported_size,duration_seconds,delivery_path,original_bytes,processed_bytes,auxiliary_bytes,revision,processing_generation,error_code,error_retryable,verified_at,created_at,updated_at').eq('id', id).maybeSingle());
    if (!data) throw new UploadError('UPLOAD_NOT_FOUND', 404); return this.parseAsset(metadata?data:{...z.record(z.string(),z.unknown()).parse(data),metadata:{}});
  }
  async assetSession(id: string): Promise<UploadSessionRow> {
    const data = await this.result(this.query('gma_upload_sessions').select('*').eq('asset_id', id).maybeSingle());
    if (!data) throw new UploadError('UPLOAD_NOT_FOUND', 404); return this.parseSession(data);
  }
  async draft(owner: string, id: string): Promise<UploadDraftRow> {
    const data = await this.result(this.query('gma_upload_drafts').select('*').eq('id', id).eq('owner_id', owner).maybeSingle());
    if (!data) throw new UploadError('UPLOAD_NOT_FOUND', 404); return draftRowSchema.parse(data) as UploadDraftRow;
  }
  async drafts(owner: string): Promise<UploadDraftRow[]> {
    return z.array(draftRowSchema).parse(await this.result(this.query('gma_upload_drafts').select('*').eq('owner_id', owner).eq('state', 'draft').order('updated_at'))) as UploadDraftRow[];
  }
  async draftSessions(owner: string, id: string): Promise<UploadSessionRow[]> {
    const data = z.array(z.unknown()).parse(await this.result(this.query('gma_upload_sessions').select('*').eq('owner_id', owner).eq('draft_id', id).order('created_at')));
    return data.map((row) => this.parseSession(row));
  }
  async uploadCommand(owner: string, action: string, payload: JsonObject): Promise<unknown> {
    return this.call('gma_upload_command', { p_owner: owner, p_action: action, p_payload: payload });
  }
  async transferAction(owner: string, id: string, action: 'pause'|'resume'|'cancel', revision: number, sha256?: string, bytes?: number): Promise<void> {
    await this.call('gma_media_transfer_action',{p_owner:owner,p_session_id:id,p_action:action,p_revision:revision,p_sha256:sha256??null,p_bytes:bytes??null});
  }
  async cleanupAllowed(owner: string, id: string): Promise<boolean> { return z.boolean().parse(await this.call('gma_media_cleanup_allowed',{p_owner:owner,p_session_id:id})); }
  async accounts(): Promise<Array<{owner_id:string;state:string}>> {
    return z.array(z.object({owner_id:z.string().uuid(),state:z.string()})).parse(await this.result(this.query('gma_upload_account_deletions').select('owner_id,state').neq('state','done').order('created_at').limit(5)));
  }
  async accountCleanupComplete(owner: string): Promise<boolean> {
    const rows=z.array(z.object({quota_released:z.boolean()})).parse(await this.result(this.query('gma_upload_sessions').select('quota_released').eq('owner_id',owner)));
    return rows.every(row=>row.quota_released);
  }
  async provisionIntent(owner: string, id: string): Promise<boolean> {
    return z.boolean().parse(await this.call('gma_media_provision_intent', { p_owner: owner, p_session_id: id }));
  }
  async optionalPrivateState(id: string): Promise<JsonObject> {
    try { return await this.privateState(id); } catch (error) { if (error instanceof UploadError && error.code === 'UPLOAD_NOT_FOUND') return {}; throw error; }
  }
  async assertCreator(owner: string): Promise<void> {
    if (!await this.result(this.query('creator_profiles').select('user_id').eq('user_id', owner).maybeSingle())) throw new UploadError('UPLOAD_FORBIDDEN', 403);
  }
  async claimSession(id: string | null, kind: string | null, worker: string): Promise<UploadJobRow | null> {
    const { data, error } = await this.db.rpc('gma_upload_claim_session_job', { p_session_id: id, p_kind: kind, p_worker: worker, p_lease_seconds: 120 });
    if (error) translateDatabaseError(error); return this.parseClaim(data);
  }
  async claimJob(worker: string, allowMockProcess: boolean): Promise<UploadJobRow | null> {
    const { data, error } = await this.db.rpc('gma_media_claim_job', { p_worker: worker, p_allow_mock_process: allowMockProcess, p_r2_process_only: false });
    if (error) translateDatabaseError(error); return this.parseClaim(data);
  }
  private parseClaim(data: unknown): UploadJobRow | null {
    const row: unknown = Array.isArray(data) ? data[0] : data;
    if (row === null || row === undefined) return null;
    // PostgREST serializes an empty composite result as a row of null fields.
    if (typeof row === 'object' && !Array.isArray(row) && 'id' in row && row.id === null
      && Object.values(row).every(value => value === null)) return null;
    return jobRowSchema.parse(row) as UploadJobRow;
  }
  async job(id: string): Promise<UploadJobRow> { return jobRowSchema.parse(await this.result(this.query('gma_upload_jobs').select('*').eq('id', id).maybeSingle())) as UploadJobRow; }
  async jobControl(id: string, worker: string, action: 'heartbeat' | 'poll', generation: number): Promise<void> {
    await this.call('gma_media_job_control', { p_job_id: id, p_worker: worker, p_action: action, p_generation: generation });
  }
  async schedule(): Promise<void> { await this.call('gma_upload_schedule', {}); }
  async finishJob(id: string, worker: string, success: boolean, code?: string, retryAfter?: string): Promise<void> {
    await this.call('gma_media_finish_job', { p_job_id: id, p_worker: worker, p_success: success, p_error: code ?? null, p_retry_after: retryAfter ?? null });
  }

  parseAsset(input: unknown): MediaAssetRow { return parseMediaAssetRow(input); }
  parseSession(input: unknown): UploadSessionRow { return parseUploadSessionRow(input); }
}

export interface MediaReadQuery extends PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }> {
  select(columns: string): MediaReadQuery;
  eq(column: string, value: string | number): MediaReadQuery;
  neq(column: string, value: string | number): MediaReadQuery;
  order(column: string): MediaReadQuery;
  limit(value: number): MediaReadQuery;
  maybeSingle(): Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
}
export interface MediaReadClient { from(table: string): MediaReadQuery }

const draftRowSchema = z.object({ id:z.string().uuid(),owner_id:z.string().uuid(),purpose:z.enum(['title','avatar','banner']),state:z.enum(['draft','published','abandoned']),metadata:z.record(z.string(),z.unknown()),revision:z.number().int().nonnegative(),title_id:z.number().nullable(),created_at:z.string(),updated_at:z.string() }).passthrough();
const jobRowSchema = z.object({ id:z.string().uuid(),kind:z.enum(['provision','verify','process','reconcile','delete']),session_id:z.string().uuid().nullable(),payload:z.record(z.string(),z.unknown()),dedupe_key:z.string(),state:z.enum(['pending','running','done','dead']),attempts:z.number().int(),run_after:z.string(),lease_owner:z.string().nullable(),lease_until:z.string().nullable(),last_error:z.string().nullable(),created_at:z.string(),updated_at:z.string() }).passthrough();
