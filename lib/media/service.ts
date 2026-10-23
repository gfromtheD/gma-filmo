import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createMediaJobProcessors, mediaJobBackoff, type MediaJobProcessors } from './jobs';
import { MediaError } from './errors';
import { provisioningNeverBound } from './stale-provision';
import { reserveSchema } from '@/lib/uploads/contracts';
import { assertUploadInput } from '@/lib/uploads/policy';
import { UploadError } from '@/lib/uploads/repository';
import type { JsonObject, UploadSessionRow, UploadJobRow, ProviderSnapshot } from '@/types/media-engine';
import { getMediaConfig } from './config';
import { canonicalRequestHash } from './idempotency';
import { describeFailure } from '@/lib/uploads/failure';
import { MediaRepository } from './repository';
import { MediaProviderRegistry } from './registry';
import { createMediaRegistry } from './runtime';
import type { ProviderAssetContext, ProviderClock } from './provider';
import { mapMediaAssetDTO, mapUploadSessionDTO, mapDraftDTO } from './dto';
import { uploadMutationEnvelopeSchema, transferDescriptorSchema, mediaProofSchema } from './contracts';

/** Errores de un archivo auxiliar que ningún reintento arregla (el archivo es así). */
const PERMANENT_VALIDATION_CODES: ReadonlySet<string> = new Set(['IMAGE_INVALID', 'SUBTITLE_INVALID', 'NORMALIZED_ASSET_TOO_LARGE']);

export class MediaService {
  readonly registry: MediaProviderRegistry;
  constructor(readonly repo = new MediaRepository(), registry?: MediaProviderRegistry,
    readonly clock: ProviderClock = { now: () => Date.now() },
    private readonly processors: MediaJobProcessors = createMediaJobProcessors()) {
    this.registry = registry ?? createMediaRegistry(repo);
  }
  /** Contexto a partir de una sesión que ya se leyó: evita volver a pedirla. */
  async contextFromSession(session: UploadSessionRow, metadata=true): Promise<ProviderAssetContext> {
    const [asset, privateState] = await Promise.all([this.repo.asset(session.asset_id, metadata), this.repo.optionalPrivateState(session.id)]);
    return { session, asset, privateState, correlationId: randomUUID(),
      transferGeneration: session.transfer_generation, processingGeneration: asset.processing_generation, expectedAssetRevision: asset.revision,
      signal: new AbortController().signal, clock: this.clock };
  }
  async context(id: string, owner?: string, metadata=true): Promise<ProviderAssetContext> {
    // El estado privado solo necesita el id de la sesión: se pide a la vez que ella (cada ida y vuelta a la base cuesta ~100 ms).
    const [session, privateState] = await Promise.all([this.repo.session(id, owner), this.repo.optionalPrivateState(id)]);
    const asset = await this.repo.asset(session.asset_id,metadata);
    return { session, asset, privateState, correlationId: randomUUID(),
      transferGeneration: session.transfer_generation, processingGeneration: asset.processing_generation, expectedAssetRevision: asset.revision,
      signal: new AbortController().signal, clock: this.clock };
  }
  async envelope(owner: string, id: string, includeTransfer = false) {
    const context = await this.context(id, owner);
    const wantsTransfer = includeTransfer && ['uploading','paused'].includes(context.session.state);
    // Borrador, offset confirmado y descriptor de transferencia no dependen entre sí: se piden a la vez (el descriptor consulta al proveedor).
    const [draft, confirmed, transfer] = await Promise.all([
      this.repo.draft(owner, context.session.draft_id),
      this.repo.confirmedOffset(id, context.transferGeneration),
      wantsTransfer ? this.registry.get(context.session.provider).getTransfer(context) : Promise.resolve(null),
    ]);
    const result = { version: 1 as const, session: mapUploadSessionDTO(context.session, Math.max(context.asset.received_bytes ?? 0, confirmed)), asset: mapMediaAssetDTO(context.asset), draftRevision: draft.revision,
      ...(transfer ? { transfer: transferDescriptorSchema.parse(transfer) } : {}) };
    return uploadMutationEnvelopeSchema.parse(result);
  }
  async reserve(owner: string, input: unknown) {
    // Tiempos por fase (ms): para localizar dónde se va el tiempo de una reserva (cada una tarda varios segundos).
    const startedAt = Date.now(); const marks: Array<[string, number]> = []; const mark = (name: string) => { marks.push([name, Date.now() - startedAt]); };
    try { return await this.reserveTimed(owner, input, mark); }
    finally { console.log('[uploads] reserva', JSON.stringify({ total_ms: Date.now() - startedAt, fases_ms: marks })); }
  }
  private async reserveTimed(owner: string, input: unknown, mark: (name: string) => void) {
    const payload = reserveSchema.parse(input);
    try { assertUploadInput(payload.role, payload.bytes, payload.sha256); } catch { throw new UploadError('UPLOAD_INVALID_INPUT', 400); }
    mark('validado');
    const hash = canonicalRequestHash(payload, { omitTopLevel: ['revision'] });
    // Comprobar que es creador y buscar una reserva anterior no dependen entre sí: van a la vez.
    const [, existing] = await Promise.all([
      payload.role !== 'avatar' ? this.repo.assertCreator(owner) : Promise.resolve(),
      this.repo.lookupReservation(owner, payload.idempotency_key),
    ]);
    mark('creador_y_busca');
    let session: UploadSessionRow;let created=false;
    if (existing) {
      if (existing.request_hash !== hash) throw new UploadError('UPLOAD_IDEMPOTENCY_CONFLICT');
      session = existing;
    } else {
      const config = getMediaConfig();
      const reservation=await this.repo.reserve(owner,{...payload,video_provider:this.registry.defaultForNewReservation(),auxiliary_provider:config.auxiliaryProvider,request_hash:hash});
      session=reservation.session;created=reservation.created;
    }
    mark('reserva_bd');
    if (session.state === 'provisioning') await this.provision(session.id, owner, true, mark);
    mark('provision');
    const result = await this.envelope(owner, session.id, true);
    mark('sobre');
    return { created, result };
  }
  async complete(owner: string, id: string, generation: number) {
    const context = await this.context(id, owner);
    if (generation !== context.transferGeneration) throw new UploadError('UPLOAD_REVISION_CONFLICT');
    if (context.asset.state === 'ready') return this.envelope(owner, id);
    if (!['uploading','paused','uploaded'].includes(context.session.state) || ['failed','rejected','deleting','deleted'].includes(context.asset.state)) throw new UploadError('UPLOAD_CANCELLED');
    if (!context.privateState.provisional_receipt && !context.privateState.receipt) {
      const receipt = await this.registry.get(context.session.provider).completeUpload(context);
      mediaProofSchema.parse(receipt.proof);
      if (!receipt.complete || receipt.receivedBytes !== context.session.expected_input_bytes) throw new UploadError('UPLOAD_NOT_COMPLETE');
      const uploadId = context.privateState.uploadId;
      if (typeof uploadId !== 'string') throw new UploadError('UPLOAD_PROVISION_RECOVERY_REQUIRED', 503);
      await this.repo.command(owner, 'bind_upload', { session_id: id, transfer_generation: generation, upload_id: uploadId,
        provider_media_id: receipt.providerMediaId, private_state: { provisional_receipt: receipt as unknown as JsonObject } });
    }
    await this.repo.command(owner, 'queue_verification', { session_id: id, transfer_generation: generation });
    return this.envelope(owner, id);
  }

  async provision(id: string, owner: string, finish = true, mark: (name: string) => void = () => undefined) {
    let context = await this.context(id, owner);
    if (context.session.state !== 'provisioning') return;
    mark('prov_contexto');
    const beforeIntent = context;
    const fresh = await this.repo.provisionIntent(owner, id);
    mark('prov_intencion');
    context = await this.context(id, owner);
    const provider = this.registry.get(context.session.provider);
    mark('prov_contexto2');
    const binding = fresh ? await provider.provisionUpload(beforeIntent) : await provider.recoverUpload(context);
    mark('prov_proveedor');
    if (!binding) throw new UploadError('UPLOAD_PROVISION_RECOVERY_REQUIRED', 503);
    await this.repo.command(owner, 'bind_upload', { session_id: id, transfer_generation: context.transferGeneration,
      upload_id: binding.uploadId, provider_media_id: binding.providerMediaId,
      private_state: { ...binding.privateState, uploadId: binding.uploadId, creation_pending: false } });
    mark('prov_enlace');
    if (!finish) return;
    const worker = randomUUID(); const job = await this.repo.claimSession(id, 'provision', worker);
    if (job) await this.repo.finishJob(job.id, worker, true);
    mark('prov_trabajo');
  }

  async drafts(owner:string) {return {version:1 as const,drafts:(await this.repo.drafts(owner)).map(mapDraftDTO)};}
  async draftDetail(owner:string,id:string) {
    const draft=await this.repo.draft(owner,id);const sessions=await this.repo.draftSessions(owner,id);
    return {version:1 as const,draft:mapDraftDTO(draft),uploads:await Promise.all(sessions.map(s=>this.envelope(owner,s.id)))};
  }
  async draftMutation(owner:string,action:'create_draft'|'update_draft'|'abandon',payload:JsonObject) {
    const raw=await this.repo.uploadCommand(owner,action,payload);const id=z.object({id:z.string().uuid()}).parse(raw).id;
    return {version:1 as const,draft:mapDraftDTO(await this.repo.draft(owner,id))};
  }
  async transfer(owner:string,id:string,generation:number) {
    const ctx=await this.context(id,owner);if(ctx.transferGeneration!==generation)throw new UploadError('UPLOAD_REVISION_CONFLICT');
    if(!['uploading','paused'].includes(ctx.session.state) || this.clock.now()>=Date.parse(ctx.session.expires_at))throw new UploadError('UPLOAD_CANCELLED');
    return this.envelope(owner,id,true);
  }
  async parts(owner:string,id:string) {
    const ctx=await this.context(id,owner);await this.transfer(owner,id,ctx.transferGeneration);
    const provider=this.registry.get(ctx.session.provider);
    if((await provider.getTransfer(ctx)).protocol!=='multipart' || !provider.getParts)throw new MediaError('UPLOAD_PROTOCOL_UNSUPPORTED');
    return {upload:await provider.getParts(ctx)};
  }
  async part(owner:string,id:string,number:number,generation:number) {
    const ctx=await this.context(id,owner);await this.transfer(owner,id,generation);const provider=this.registry.get(ctx.session.provider);
    if((await provider.getTransfer(ctx)).protocol!=='multipart' || !provider.getPartTransfer)throw new MediaError('UPLOAD_PROTOCOL_UNSUPPORTED');
    return {part:await provider.getPartTransfer(ctx,number)};
  }
  async label(owner:string,id:string,revision:number,language:string) {await this.context(id,owner);await this.repo.uploadCommand(owner,'label_subtitle',{session_id:id,revision,language});return this.envelope(owner,id);}
  async reorder(owner:string,id:string,input:{draft_id:string;revision:number;position:number}) {
    const ctx=await this.context(id,owner);if(ctx.session.draft_id!==input.draft_id)throw new UploadError('UPLOAD_NOT_FOUND',404);
    await this.repo.uploadCommand(owner,'reorder',{...input,asset_id:ctx.asset.id});return this.envelope(owner,id);
  }
  async pause(owner: string,id: string,revision: number) {await this.repo.transferAction(owner,id,'pause',revision);return this.envelope(owner,id);}
  async resume(owner: string,id: string,sha256: string,bytes: number,revision: number) {await this.repo.transferAction(owner,id,'resume',revision,sha256,bytes);return this.envelope(owner,id,true);}
  async cancel(owner: string,id: string,revision: number) {await this.repo.transferAction(owner,id,'cancel',revision);return this.envelope(owner,id);}
  async retry(owner: string,id: string,input: {revision:number;asset_revision:number;idempotency_key:string}) {
    const payload={session_id:id,...input};
    const raw=await this.repo.command(owner,'retry',{...payload,request_hash:canonicalRequestHash(payload,{omitTopLevel:['revision','asset_revision']})});
    const result=z.object({session:z.unknown(),asset:z.unknown()}).parse(raw);
    const session=this.repo.parseSession(result.session);const asset=this.repo.parseAsset(result.asset);
    const draft=await this.repo.draft(owner,session.draft_id);
    return uploadMutationEnvelopeSchema.parse({version:1,session:mapUploadSessionDTO(session,asset.received_bytes??0),asset:mapMediaAssetDTO(asset),draftRevision:draft.revision});
  }
  async finalizeAccounts(deleteAuth: (owner:string)=>Promise<void>): Promise<void> {
    for(const account of await this.repo.accounts()) {
      if(account.state==='done')continue;
      if(account.state==='cleanup') {
        if(!await this.repo.accountCleanupComplete(account.owner_id))continue;
        await this.repo.uploadCommand(account.owner_id,'purge_account',{});
      }
      await deleteAuth(account.owner_id);
    }
  }
  private fence(context: ProviderAssetContext, job: UploadJobRow, worker: string): JsonObject {
    return {session_id:context.session.id,job_id:job.id,worker,processing_generation:context.processingGeneration,
      transfer_generation:context.transferGeneration,expected_asset_revision:context.asset.revision};
  }
  async run(job: UploadJobRow, worker: string, allowMockProcess = false): Promise<void> {
    if (!job.session_id) throw new UploadError('UPLOAD_INVALID_JOB');
    let context=await this.context(job.session_id);
    const abort=new AbortController();context={...context,signal:abort.signal};
    let heartbeatBusy=false;let heartbeatError:unknown;
    const heartbeat=setInterval(()=>{if(heartbeatBusy)return;heartbeatBusy=true;void this.repo.jobControl(job.id,worker,'heartbeat',context.processingGeneration)
      .catch((error:unknown)=>{heartbeatError=error;abort.abort();}).finally(()=>{heartbeatBusy=false;});},15_000);
    try {
      if (Number(job.payload.processing_generation ?? context.processingGeneration)!==context.processingGeneration) throw new UploadError('UPLOAD_LEASE_LOST');
      if(job.kind==='provision') await this.provision(context.session.id,context.session.owner_id,false);
      else if(job.kind==='verify') {
        if(context.asset.state!=='ready') {
          const provider=this.registry.get(context.session.provider);
          if(!context.privateState.receipt) {
            const receipt=await provider.inspectUpload(context);
            await this.repo.command(context.session.owner_id,'receipt',{...this.fence(context,job,worker),receipt:receipt as unknown as JsonObject});
            context={...await this.context(job.session_id),signal:abort.signal};
          }
          if(context.session.max_duration_seconds===0 || provider.capabilities.processing==='managed') {
            const snapshot=provider.validateAsset?await provider.validateAsset(context):await provider.inspectAsset(context);
            const done=await this.applySnapshot(context,job,worker,snapshot);
            if(!done) return;
          }
        }
      } else if(job.kind==='process') {
        if(!allowMockProcess) throw new UploadError('UPLOAD_PROTOCOL_UNSUPPORTED');
        const processor=this.processors.get(context.session.provider);if(!processor)throw new UploadError('UPLOAD_PROTOCOL_UNSUPPORTED');
        if(context.asset.state!=='ready') {
          await this.repo.command(context.session.owner_id,'processing',this.fence(context,job,worker));
          context={...await this.context(job.session_id),signal:abort.signal};
          const snapshot=await processor.process(context);
          if(heartbeatError)throw heartbeatError;
          if(!await this.applySnapshot(context,job,worker,snapshot))return;
        }
      } else if(job.kind==='delete') await this.remove(context);
      else await this.reconcile(context);
      const current=await this.repo.job(job.id);
      if(current.state==='running') await this.repo.finishJob(job.id,worker,true);
    } catch(error) {
      const code=error instanceof UploadError || error instanceof MediaError ? error.code : error instanceof Error && 'code' in error && typeof error.code==='string'?error.code:'UPLOAD_JOB_FAILED';
      // El código guardado en el trabajo puede ser genérico (UPLOAD_JOB_FAILED): se deja la excepción original en el registro.
      if(code!=='UPLOAD_CLEANUP_UNCONFIRMED')console.error('[uploads] job failed',{kind:job.kind,session:String(job.session_id).slice(0,8),attempt:job.attempts,...describeFailure(error)});
      const current=await this.repo.job(job.id);
      if(current.state==='running' && current.lease_owner===worker) {
        if(code==='UPLOAD_CLEANUP_UNCONFIRMED')await this.repo.jobControl(job.id,worker,'poll',context.processingGeneration);
        else if(job.kind==='verify' && PERMANENT_VALIDATION_CODES.has(code) && (context.asset.state==='validating' || context.asset.state==='processing'))
          // Reintentar no arregla un archivo inválido: se rechaza a la primera para que el creador lo sepa ya.
          await this.repo.command(context.session.owner_id,'failed',{...this.fence(context,job,worker),error_code:code,retryable:false});
        else await this.repo.finishJob(job.id,worker,false,code,new Date(this.clock.now()+mediaJobBackoff(job.attempts)).toISOString());
      }
    } finally {clearInterval(heartbeat);abort.abort();}
  }
  private async applySnapshot(context: ProviderAssetContext, job: UploadJobRow, worker: string, snapshot: ProviderSnapshot): Promise<boolean> {
    if(snapshot.status==='ready') {
      await this.repo.command(context.session.owner_id,'ready',{...this.fence(context,job,worker),snapshot:snapshot as unknown as JsonObject,
        delivery_path:`/api/media/${context.asset.id}`});return true;
    }
    if(snapshot.status==='failed' || snapshot.status==='rejected' || this.clock.now()-Date.parse(job.created_at)>=6*3600_000) {
      await this.repo.command(context.session.owner_id,'failed',{...this.fence(context,job,worker),error_code:snapshot.error?.code??'MEDIA_PROCESSING_DEADLINE',
        retryable:snapshot.error?.retryable??true});return true;
    }
    await this.repo.jobControl(job.id,worker,'poll',context.processingGeneration);return false;
  }
  async reconcile(context: ProviderAssetContext): Promise<void> {
    if(context.session.state==='cancelling' || context.asset.state==='deleting') return this.remove(context);
    if(context.asset.state==='ready') {
      const draft=await this.repo.draft(context.session.owner_id,context.session.draft_id);
      if(draft.state==='draft' && this.clock.now()>Date.parse(context.session.expires_at)+6*86400000){await this.repo.uploadCommand(context.session.owner_id,'cancel',{session_id:context.session.id});return;}
      await this.registry.get(context.session.provider).maintainAsset?.(context);return;
    }
    if(['deleted','failed','rejected'].includes(context.asset.state))return;
    if(this.clock.now()>=Date.parse(context.session.expires_at)) {await this.repo.uploadCommand(context.session.owner_id,'cancel',{session_id:context.session.id});return;}
    if(context.session.state==='provisioning') return this.provision(context.session.id,context.session.owner_id,false);
    if(!context.privateState.provisional_receipt && !context.privateState.receipt) {
      try {const receipt=await this.registry.get(context.session.provider).inspectUpload(context);
        if(receipt.complete && typeof context.privateState.uploadId==='string')await this.repo.command(context.session.owner_id,'bind_upload',{session_id:context.session.id,transfer_generation:context.transferGeneration,upload_id:context.privateState.uploadId,provider_media_id:receipt.providerMediaId,private_state:{provisional_receipt:receipt as unknown as JsonObject}});
      } catch(error) {if((error instanceof UploadError || error instanceof MediaError || error instanceof Error && 'code' in error) && 'code' in error && error.code==='UPLOAD_NOT_COMPLETE')return;throw error;}
    }
    await this.repo.command(context.session.owner_id,'queue_verification',{session_id:context.session.id,transfer_generation:context.transferGeneration});
  }
  async remove(context: ProviderAssetContext): Promise<void> {
    if(context.asset.state!=='deleting' || context.session.state!=='cancelling')return;
    if(!await this.repo.cleanupAllowed(context.session.owner_id,context.session.id))throw new UploadError('UPLOAD_CLEANUP_UNCONFIRMED');
    const provider=this.registry.get(context.session.provider);
    if(context.privateState.creation_pending===true || context.privateState.finalization_pending===true || !context.privateState.uploadId && context.session.provider_data.provision_started===true) {
      const binding=await provider.recoverUpload(context);
      if(!binding) {
        // Sin archivo atado en el proveedor y pasado el plazo del provisioning: no hay nada que borrar allí (ver stale-provision.ts).
        if(provisioningNeverBound({privateState:context.privateState,providerData:context.session.provider_data,createdAt:context.session.created_at,now:this.clock.now()})) {
          await this.repo.command(context.session.owner_id,'delete_confirmed',{session_id:context.session.id,absent:true,writes_revoked:true,safe_after:null});
          return;
        }
        throw new UploadError('UPLOAD_CLEANUP_UNCONFIRMED');
      }
      await this.repo.command(context.session.owner_id,'bind_upload',{session_id:context.session.id,transfer_generation:context.transferGeneration,upload_id:binding.uploadId,provider_media_id:binding.providerMediaId,private_state:{...binding.privateState,uploadId:binding.uploadId,creation_pending:false}});
      context=await this.context(context.session.id);
    }
    const observed=await provider.deleteAsset(context);
    if(!observed.absent || !observed.writesRevoked || (observed.safeAfter && Date.parse(observed.safeAfter)>this.clock.now()))throw new UploadError('UPLOAD_CLEANUP_UNCONFIRMED');
    if(context.privateState.finalization_pending===true && typeof context.privateState.uploadId==='string')await this.repo.command(context.session.owner_id,'bind_upload',{session_id:context.session.id,transfer_generation:context.transferGeneration,upload_id:context.privateState.uploadId,provider_media_id:null,private_state:{finalization_pending:false}});
    await this.repo.command(context.session.owner_id,'delete_confirmed',{session_id:context.session.id,absent:observed.absent,writes_revoked:observed.writesRevoked,safe_after:observed.safeAfter});
  }
  async tick(limit=5, allowMockProcess=false): Promise<number> {
    await this.repo.schedule();const worker=randomUUID();const deadline=this.clock.now()+20_000;let count=0;
    while(count<Math.min(20,Math.max(0,limit)) && this.clock.now()<deadline) {
      const job=await this.repo.claimJob(worker,allowMockProcess);if(!job)break;
      await this.run(job,worker,allowMockProcess);count++;
    }
    return count;
  }
}
