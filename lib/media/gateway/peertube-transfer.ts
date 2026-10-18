import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { ProviderAssetContext } from '../provider';
import type { UploadReceipt } from '@/types/media-engine';
import { MediaError } from '../errors';
import { MockMediaStorage } from '../mock-storage';
import { MediaRepository } from '../repository';
import { PeerTubeClient, receivedBytesFromRange } from '../providers/peertube-client';

const bindingSchema = z.object({ uploadId:z.string().min(1),uploadLocation:z.string().min(1),correlationName:z.string().min(1) }).passthrough();
const receiptSchema = z.object({complete:z.literal(true),receivedBytes:z.number().int().positive(),sourceSha256:z.string(),identity:z.literal('sha256'),providerMediaId:z.string().uuid(),proof:z.object({
  kind:z.literal('peertube-gateway'),uploadId:z.string(),videoUUID:z.string().uuid(),totalBytes:z.number().int().positive(),
  upstreamReceivedBytes:z.number().int().positive(),gmaSha256:z.string(),correlationName:z.string(),finalizingAt:z.string().datetime(),
}).strict()}).strict();

function upstreamOffset(response:{status:number;range:string|null},total:number):number {
  if(response.status===200)return total;
  const offset=receivedBytesFromRange(response.range);
  if(offset===null||!Number.isSafeInteger(offset)||offset>total)throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
  return offset;
}

/** Durable scratch is authoritative for the source SHA; only confirmed upstream bytes are browser offsets. */
export async function transferPeerTube(context:ProviderAssetContext,storage:MockMediaStorage,repo:MediaRepository,client:PeerTubeClient):Promise<{offset:number;uuid:string|null}> {
  const {session,asset,transferGeneration:generation}=context;
  const writer=session.transfer_lease_owner;const fence=session.transfer_fence;
  if(!writer||!Number.isSafeInteger(fence)||fence<1)throw new MediaError('UPLOAD_REVISION_CONFLICT');
  const assertLease=async()=>{
    if(context.signal.aborted)throw new MediaError('UPLOAD_CANCELLED');
    await repo.renewTransfer(session.owner_id,session.id,generation,writer,fence);
  };
  await assertLease();
  const privateState=await repo.privateState(session.id);
  const binding=bindingSchema.parse(privateState);
  const correlation=`gma-${asset.id}-a${generation}`;
  if(binding.correlationName!==correlation)throw new MediaError('IDEMPOTENCY_CONFLICT');
  const sqlChunks=await repo.transferChunks(session.id,generation);
  const disk=await storage.offset(session.id,generation);
  if(disk.chunks.length!==sqlChunks.length)throw new MediaError('UPLOAD_REVISION_CONFLICT');
  let localOffset=0;
  for(let i=0;i<sqlChunks.length;i++){
    const sql=sqlChunks[i]!;const file=disk.chunks[i]!;
    if(sql.start_byte!==localOffset||sql.start_byte!==file.startByte||sql.end_byte!==file.endByte||sql.sha256!==file.sha256)throw new MediaError('UPLOAD_SOURCE_MISMATCH');
    localOffset=sql.end_byte+1;
  }
  if(localOffset!==disk.offset||localOffset>session.expected_input_bytes)throw new MediaError('UPLOAD_SOURCE_MISMATCH');
  const persistedReceipt=privateState.provisional_receipt??privateState.receipt;
  const stored=receiptSchema.safeParse(persistedReceipt);
  if(persistedReceipt!==undefined&&!stored.success)throw new MediaError('IDEMPOTENCY_CONFLICT');
  if(stored.success){
    const receipt=stored.data;
    if(receipt.receivedBytes!==session.expected_input_bytes||receipt.sourceSha256!==session.source_sha256||receipt.proof.uploadId!==binding.uploadId
      ||receipt.proof.videoUUID!==receipt.providerMediaId||receipt.proof.totalBytes!==session.expected_input_bytes||receipt.proof.upstreamReceivedBytes!==session.expected_input_bytes
      ||receipt.proof.gmaSha256!==session.source_sha256||receipt.proof.correlationName!==correlation)throw new MediaError('IDEMPOTENCY_CONFLICT');
    return {offset:session.expected_input_bytes,uuid:receipt.providerMediaId};
  }
  const persist=async(patch:Parameters<MediaRepository['gatewayState']>[5],uuid?:string)=>{
    await assertLease();await repo.gatewayState(session.owner_id,session.id,generation,writer,fence,patch,uuid);
  };
  const confirm=async(offset:number)=>{
    for(const chunk of sqlChunks){
      if(chunk.end_byte>=offset)break;
      if(chunk.upstream_confirmed)continue;
      await assertLease();
      await repo.commitChunk(session.owner_id,{sessionId:session.id,generation,writer,fence,startByte:chunk.start_byte,endByte:chunk.end_byte,sha256:chunk.sha256,
        storageRelative:chunk.storage_relative,upstreamConfirmed:true});
      chunk.upstream_confirmed=true;
    }
  };
  const fullHash=async()=>{
    if(localOffset!==session.expected_input_bytes)throw new MediaError('UPLOAD_NOT_COMPLETE');
    try{await storage.complete(session.id,asset.id,generation,session.expected_input_bytes,session.source_sha256);}
    catch(error){
      if(error instanceof MediaError&&error.code==='UPLOAD_SOURCE_MISMATCH')await client.cancelUpload(binding.uploadLocation);
      throw error;
    }
  };
  let finalizingAt=typeof privateState.finalizingAt==='string'&&Number.isFinite(Date.parse(privateState.finalizingAt))?privateState.finalizingAt:null;
  const finish=async(uuid:string)=>{
    await fullHash();await assertLease();
    if(!finalizingAt)throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    const receipt={complete:true,receivedBytes:session.expected_input_bytes,sourceSha256:session.source_sha256,identity:'sha256',providerMediaId:uuid,
      proof:{kind:'peertube-gateway',uploadId:binding.uploadId,videoUUID:uuid,totalBytes:session.expected_input_bytes,upstreamReceivedBytes:session.expected_input_bytes,
        gmaSha256:session.source_sha256,correlationName:correlation,finalizingAt}} satisfies UploadReceipt;
    await confirm(session.expected_input_bytes);
    await persist({localOffset:localOffset,upstreamOffset:session.expected_input_bytes,finalization_pending:false,videoUUID:uuid,provisional_receipt:receipt},uuid);
    return {offset:session.expected_input_bytes,uuid};
  };
  const recover=async()=>{
    await fullHash();await assertLease();
    if(privateState.finalization_pending!==true&&!finalizingAt)throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    const uuid=await client.recoverVideoByCorrelation(correlation);
    if(!uuid)throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
    return finish(uuid);
  };
  let offset:number;
  try{offset=upstreamOffset(await client.queryUploadOffset(binding.uploadLocation,session.expected_input_bytes),session.expected_input_bytes);}
  catch(error){if(error instanceof MediaError&&error.code==='UPLOAD_NOT_FOUND'&&privateState.finalization_pending===true)return recover();throw error;}
  const previouslyConfirmed=sqlChunks.reduce((result,chunk)=>chunk.upstream_confirmed?Math.max(result,chunk.end_byte+1):result,0);
  if(offset<previouslyConfirmed)throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
  if(offset>localOffset)throw new MediaError('UPLOAD_SOURCE_MISMATCH');
  await confirm(offset);await persist({localOffset:localOffset,upstreamOffset:offset});
  if(offset===session.expected_input_bytes)return recover();
  for(const chunk of disk.chunks){
    if(chunk.endByte<offset)continue;
    if(chunk.startByte>offset)throw new MediaError('UPLOAD_REVISION_CONFLICT');
    const last=chunk.endByte+1===session.expected_input_bytes;
    if(last){
      await fullHash();finalizingAt=finalizingAt??new Date(context.clock.now()).toISOString();
      await persist({finalization_pending:true,finalizingAt:finalizingAt,localOffset:localOffset,upstreamOffset:offset,sourceSha256:session.source_sha256});
    }
    await assertLease();
    const bytes=await readFile(chunk.filePath);
    const response=await client.putUploadChunk(binding.uploadLocation,offset,chunk.endByte,session.expected_input_bytes,bytes.subarray(offset-chunk.startByte));
    if(response.uuid){if(!last)throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');return finish(response.uuid);}
    const confirmed=upstreamOffset(response,session.expected_input_bytes);
    if(confirmed<offset||confirmed>chunk.endByte+1)throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
    offset=confirmed;await confirm(offset);await persist({localOffset:localOffset,upstreamOffset:offset});
    if(offset===session.expected_input_bytes)return recover();
    if(offset<=chunk.endByte)return {offset,uuid:null};
  }
  return {offset,uuid:null};
}
