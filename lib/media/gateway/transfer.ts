import { randomUUID } from 'node:crypto';
import type { IncomingMessage,ServerResponse } from 'node:http';
import type { KeyObject } from 'node:crypto';
import { verifyMediaCapability } from '../capabilities';
import { MediaError } from '../errors';
import { MediaService } from '../service';
import { MockMediaStorage } from '../mock-storage';
import type { MediaRepository } from '../repository';
import type { PeerTubeClient } from '../providers/peertube-client';
import { parseContentRange,readChunk,requireDisk } from './spool';

export interface GatewayDependencies {
  repository:MediaRepository;storage:MockMediaStorage;publicKeys:Readonly<Record<string,string|KeyObject>>;
  origins:readonly string[];peerTube?:PeerTubeClient;diskCheck?:(root:string,bytes:number)=>Promise<void>;
}
export async function transfer(request:IncomingMessage,response:ServerResponse,id:string,auxiliary:boolean,deps:GatewayDependencies):Promise<void> {
  // Tiempos por fase de cada trozo (ms desde que llega la petición): sirven para saber dónde se va el tiempo de una subida lenta.
  const startedAt=Date.now();const marks:Array<[string,number]>=[];const mark=(name:string)=>{marks.push([name,Date.now()-startedAt]);};
  let timedRange:{start:number;size:number}|null=null;
  try {
  const service=new MediaService(deps.repository);let context=await service.context(id);
  const {session}=context;const token=/^Bearer ([a-zA-Z0-9_.-]+)$/.exec(request.headers.authorization??'')?.[1]??'';
  await verifyMediaCapability(token,{sessionId:id,assetId:session.asset_id,generation:session.transfer_generation,scope:'upload',method:'PUT',
    resourcePath:`transfer/${id}/${session.transfer_generation}/body`,expectedBytes:session.expected_input_bytes},deps.publicKeys,async()=>{
      await deps.repository.command(session.owner_id,'authorize_transfer',{session_id:id,transfer_generation:session.transfer_generation});return true;});
  if (auxiliary !== (session.max_duration_seconds===0) || !['mock','peertube'].includes(session.provider))throw new MediaError('UPLOAD_PROTOCOL_UNSUPPORTED');
  const range=auxiliary?{query:false as const,start:0,end:session.expected_input_bytes-1,size:session.expected_input_bytes}:parseContentRange(request.headers['content-range'],session.expected_input_bytes);
  if(range.query && Number(request.headers['content-length']??0)!==0)throw new MediaError('UPLOAD_INVALID_INPUT');
  mark('auth');
  if(!range.query)timedRange={start:range.start,size:range.size};
  const writer=`gateway-${randomUUID()}`;const claim=await deps.repository.claimTransfer(session.owner_id,id,session.transfer_generation,writer);
  let leaseError:unknown;const heartbeat=setInterval(()=>{void deps.repository.renewTransfer(session.owner_id,id,session.transfer_generation,writer,claim.fence).catch(error=>{leaseError=error;});},5_000);
  try {
    mark('claim');
    // Lecturas independientes tras el turno: en paralelo (cada viaje a la base de datos son ~35-100 ms por trozo).
    const [fresh,committed]=await Promise.all([service.context(id),deps.repository.transferChunks(id,session.transfer_generation)]);context=fresh;
    await deps.storage.recoverCommitted(id,session.transfer_generation,committed);
    mark('recover1');
    if(!range.query){
      await (deps.diskCheck??requireDisk)(deps.storage.root,range.size);
      mark('disk');
      const body=await readChunk(request,range.size);if(leaseError)throw leaseError;mark('recibido');
      await deps.storage.writeChunk({sessionId:id,assetId:session.asset_id,generation:session.transfer_generation,fence:claim.fence,
        expectedBytes:session.expected_input_bytes,startByte:range.start,endByte:range.end,sha256:body.sha256,bytes:body.bytes},async()=>{
          await deps.repository.commitChunk(session.owner_id,{sessionId:id,generation:session.transfer_generation,writer,fence:claim.fence,
            startByte:range.start,endByte:range.end,sha256:body.sha256,storageRelative:`transfer/${id}/${session.transfer_generation}/chunks/${range.start}-${range.end}-${body.sha256}.bin`,upstreamConfirmed:session.provider==='mock'});
        });
    }
    mark('guardado');
    const [afterCommit,peerTubeContext]=await Promise.all([deps.repository.transferChunks(id,session.transfer_generation),
      session.provider==='peertube'?service.context(id):Promise.resolve(null)]);
    let offset=(await deps.storage.recoverCommitted(id,session.transfer_generation,afterCommit)).offset;
    mark('recover2');
    if(session.provider==='peertube'){
      if(!deps.peerTube||!peerTubeContext)throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');
      const {transferPeerTube}=await import('./peertube-transfer');
      offset=(await transferPeerTube(peerTubeContext,deps.storage,deps.repository,deps.peerTube)).offset;
    }else if(offset===session.expected_input_bytes){
      const receipt=await deps.storage.complete(id,session.asset_id,session.transfer_generation,session.expected_input_bytes,session.source_sha256);
      const uploadId=context.privateState.uploadId;if(typeof uploadId!=='string')throw new MediaError('UPLOAD_PROVISION_RECOVERY_REQUIRED');
      await deps.repository.gatewayState(session.owner_id,id,session.transfer_generation,writer,claim.fence,{provisional_receipt:{complete:true,receivedBytes:receipt.size,sourceSha256:receipt.sha256,identity:'sha256',providerMediaId:null,
          proof:{kind:'mock-sha256',size:receipt.size,sha256:receipt.sha256,transferGeneration:session.transfer_generation,chunkManifestHash:receipt.chunkManifestHash}}});
    }
    mark('peertube');
    if(leaseError)throw leaseError;
    response.statusCode=offset===session.expected_input_bytes?200:308;
    if(offset>0)response.setHeader('Range',`bytes=0-${offset-1}`);
    if(context.privateState.mockScenario==='upload-response-lost' && offset===session.expected_input_bytes && await deps.storage.claimScenarioOnce(id,'upload-response-lost')){response.destroy();return;}
    response.end();
  }finally{clearInterval(heartbeat);await deps.repository.releaseTransfer(session.owner_id,id,session.transfer_generation,writer,claim.fence).catch(()=>undefined);}
  } finally {
    if(timedRange)console.log('[gateway] trozo',JSON.stringify({sesion:id.slice(0,8),desde:timedRange.start,bytes:timedRange.size,total_ms:Date.now()-startedAt,fases_ms:marks}));
  }
}
