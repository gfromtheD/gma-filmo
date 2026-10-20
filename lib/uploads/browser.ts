'use client';
import { Upload } from 'tus-js-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { TUS_CHUNK_SIZE,UPLOAD_LIMITS } from './policy';
import type { UploadSession,MediaAsset,UploadDraft,AssetRole } from './types';
import {isVideoRole} from './policy';
import type {ReceivedPart} from './video-provider';
import type { ClientDraftResponse } from './client-models';

export async function uploadApi<T>(path:string,method='GET',body?:unknown):Promise<T> {
 const auth=getSupabaseBrowserClient().auth;
 const execute=async(token:string)=>fetch(path,{method,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body===undefined?undefined:JSON.stringify(body)});
 let {data:{session}}=await auth.getSession();
 if(!session)throw new Error('Inicia sesión para subir contenido');
 let response=await execute(session.access_token);
 if(response.status===401){session=(await auth.refreshSession()).data.session;if(!session)throw new Error('Inicia sesión para continuar');response=await execute(session.access_token);}
 const data=await response.json();if(!response.ok)throw new Error(typeof data.error==='string'?data.error:data.error?.message??'No se pudo completar la operación');return data as T;
}
let draftTask:Promise<UploadDraft>|undefined;
let draftOwner='';
export async function titleDraft():Promise<UploadDraft> {
 const {data:{session}}=await getSupabaseBrowserClient().auth.getSession();if(!session)throw new Error('Inicia sesión');
 if(draftOwner!==session.user.id){draftTask=undefined;draftOwner=session.user.id;}
 if(!draftTask)draftTask=(async()=>{
   const {drafts}=await uploadApi<{drafts:UploadDraft[]}>('/api/upload-drafts');
   const existing=drafts.find(d=>d.purpose==='title' && !d.title_id);
   return existing??(await uploadApi<{draft:UploadDraft}>('/api/upload-drafts','POST',{purpose:'title'})).draft;
 })().catch(e=>{draftTask=undefined;throw e;});
 const draft=await draftTask;
 return (await uploadApi<{draft:UploadDraft}>('/api/upload-drafts/'+draft.id)).draft;
}
export function resetTitleDraft(){draftTask=undefined;}
export async function draftDetail(){const d=await titleDraft();return uploadApi<ClientDraftResponse>('/api/upload-drafts/'+d.id);}
export function hashFile(file:File,signal?:AbortSignal,onProgress?:(n:number)=>void):Promise<string> {
 return new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('../../workers/upload-hash.worker.ts',import.meta.url));
   const abort=()=>{worker.terminate();reject(new DOMException('Interrumpido','AbortError'));};
   if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
   const finish=()=>{worker.terminate();signal?.removeEventListener('abort',abort);};
   worker.onerror=()=>{finish();reject(new Error('No se pudo comprobar el archivo'));};
   worker.onmessage=e=>{if(e.data.sha256){finish();resolve(e.data.sha256);}else if(e.data.error){finish();reject(new Error(e.data.error));}else onProgress?.(e.data.progress);};
   worker.postMessage({file});
 });
}
function put(file:Blob,url:string,signal:AbortSignal,progress:(n:number)=>void):Promise<void> {
 return new Promise((resolve,reject)=>{
 const xhr=new XMLHttpRequest();const abort=()=>xhr.abort();
 if(signal.aborted){reject(new DOMException('Interrumpido','AbortError'));return;}
 signal.addEventListener('abort',abort,{once:true});
 const done=()=>signal.removeEventListener('abort',abort);
 xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(e.loaded/e.total*100);};
 xhr.onload=()=>{done();if(xhr.status>=200&&xhr.status<300)resolve();else reject(new Error('No se pudo transferir el archivo'));};
 xhr.onerror=()=>{done();reject(new Error('Error de red'));};xhr.onabort=()=>{done();reject(new DOMException('Interrumpido','AbortError'));};
 xhr.open('PUT',url);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');xhr.send(file);
 });
}
/** ListParts, not local success callbacks, determines resumable progress. */
async function multipart(file:File,session:UploadSession,signal:AbortSignal,progress:(n:number)=>void) {
 type Inspection={parts:ReceivedPart[];complete:boolean;partSize:number;generation:number};
 const inspect=async()=> (await uploadApi<{upload:Inspection}>('/api/uploads/'+session.id+'/parts','POST')).upload;
 const initial=await inspect();if(initial.complete){progress(100);return;}
 const size=initial.partSize,count=Math.ceil(file.size/size);
 const confirmed=new Map(initial.parts.map(p=>[p.number,p.size]));const sending=new Map<number,number>();
 const expected=(n:number)=>Math.min(size,file.size-(n-1)*size);
 const update=()=>progress(Math.min(100,(Array.from(confirmed.values()).reduce((a,b)=>a+b,0)+Array.from(sending.values()).reduce((a,b)=>a+b,0))/file.size*100));
 const missing=Array.from({length:count},(_,i)=>i+1).filter(n=>confirmed.get(n)!==expected(n));let cursor=0;
 update();
 const parallel=new AbortController(),cancel=()=>parallel.abort();signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)parallel.abort();
 const worker=async()=>{while(cursor<missing.length){const number=missing[cursor++]!;confirmed.delete(number);
   for(let attempt=0;attempt<5;attempt++) {
     if(parallel.signal.aborted)throw new DOMException('Interrumpido','AbortError');
     try {
       const {part}=await uploadApi<{part:{url:string;size:number}}>('/api/uploads/'+session.id+'/part','POST',{number,generation:initial.generation});
       await put(file.slice((number-1)*size,number*size,'application/octet-stream'),part.url,parallel.signal,p=>{sending.set(number,expected(number)*p/100);update();});
       sending.delete(number);confirmed.set(number,expected(number));update();break;
     }catch(e){sending.delete(number);if(parallel.signal.aborted)throw e;
       const observed=await inspect();if(observed.complete)return;
       const received=observed.parts.find(p=>p.number===number);
       if(received?.size===expected(number)){confirmed.set(number,received.size);update();break;}
       if(attempt===4)throw e;
       await delay(parallel.signal);
     }
   }
 }};
 try{await Promise.all([worker(),worker()]);}catch(e){parallel.abort();throw e;}finally{signal.removeEventListener('abort',cancel);}
 const final=await inspect();if(!final.complete && final.parts.some(p=>p.size!==expected(p.number)))throw new Error('Las partes recibidas necesitan recuperación');
}
function tus(file:File,url:string,session:UploadSession,signal:AbortSignal,progress:(n:number)=>void):Promise<void> {
 return new Promise((resolve,reject)=>{
 const upload=new Upload(file,{uploadUrl:url,chunkSize:TUS_CHUNK_SIZE,parallelUploads:1,retryDelays:[0,1000,3000,5000,10000],storeFingerprintForResuming:false,
   fingerprint:async()=>session.id+':'+session.source_sha256,
   onProgress:(loaded,total)=>progress(loaded/total*100),onError:e=>{done();reject(e);},onSuccess:()=>{done();resolve();}});
 const abort=()=>{void upload.abort(false);done();reject(new DOMException('Interrumpido','AbortError'));};
 const done=()=>signal.removeEventListener('abort',abort);
 if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});upload.start();
 });
}
function delay(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);reject(new DOMException('Interrumpido','AbortError'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},2500);
 if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
});}
export async function uploadAsset(input:{file:File;role:AssetRole;key:string;signal:AbortSignal;sessionId?:string;draftId?:string;
 onSession?:(s:UploadSession)=>void;onProgress?:(n:number)=>void;onState?:(s:string)=>void}) {
 const {file,role,signal}=input;
 if(file.size<1||file.size>UPLOAD_LIMITS[role])throw new Error('El archivo supera el límite o está vacío');
 input.onState?.('Comprobando identidad');const sha=await hashFile(file,signal);
 if(signal.aborted)throw new DOMException('Interrumpido','AbortError');
 let session:UploadSession;
 if(input.sessionId)session=(await uploadApi<{session:UploadSession}>('/api/uploads/'+input.sessionId+'/resume','POST',{sha256:sha,bytes:file.size})).session;
 else {
   const draft=input.draftId? (await uploadApi<{draft:UploadDraft}>('/api/upload-drafts/'+input.draftId)).draft:await titleDraft();
   session=(await uploadApi<{session:UploadSession}>('/api/uploads','POST',{draft_id:draft.id,revision:draft.revision,role,bytes:file.size,sha256:sha,
     file_name:file.name,content_type:file.type||'application/octet-stream',language:role==='subtitles'?'und':undefined,idempotency_key:input.key})).session;
 }
 input.onSession?.(session);
 if(signal.aborted)throw new DOMException('Interrumpido','AbortError');
 const url=session.provider_data.uploadUrl;if(typeof url!=='string' && !session.multipart_upload_id && !session.provider_data.transfer_complete)throw new Error('La sesión necesita recuperación del proveedor');
 input.onState?.('Transfiriendo');const progress=input.onProgress??(()=>{});
 if(!session.provider_data.transfer_complete){if(session.provider==='stream')await tus(file,String(url),session,signal,progress);else if(isVideoRole(role))await multipart(file,session,signal,progress);else await put(file,String(url),signal,progress);}
 if(signal.aborted)throw new DOMException('Interrumpido','AbortError');
 input.onState?.('Validando y procesando');
 await uploadApi('/api/uploads/'+session.id+'/complete','POST');
 const deadline=Date.now()+20*60*1000;
 while(Date.now()<deadline) {
   if(signal.aborted)throw new DOMException('Interrumpido','AbortError');
   const detail=await uploadApi<{session:UploadSession;asset:MediaAsset}>('/api/uploads/'+session.id);
   if(detail.asset.state==='ready')return {session:detail.session,asset:detail.asset};
   if(['rejected','deleted','deleting'].includes(detail.asset.state) || ['cancelling','cancelled','expired'].includes(detail.session.state))throw new Error('El archivo no ha superado la validación');
   await delay(signal);
 }
 throw new Error('El procesamiento continúa. Puedes recuperar el borrador más tarde.');
}
export async function uploadAvatar(file:File) {
 if(process.env.NEXT_PUBLIC_UPLOAD_ENGINE_V2==='true'){
   const {managedDraftSchema,uploadManagedAsset}=await import('./managed-browser');
   const {data:{session}}=await getSupabaseBrowserClient().auth.getSession();if(!session)throw new Error('Inicia sesión');
   const created=await uploadApi<{draft:unknown}>('/api/upload-drafts','POST',{purpose:'avatar'});
   const draft=managedDraftSchema.parse(created.draft);
   const ready=await uploadManagedAsset({file,role:'avatar',draft,idempotencyKey:crypto.randomUUID(),signal:new AbortController().signal});
   await uploadApi('/api/upload-drafts/'+draft.id+'/avatar','POST');
   return `/api/media/${ready.asset.mediaId}`;
 }
 const {draft}=await uploadApi<{draft:UploadDraft}>('/api/upload-drafts','POST',{purpose:'avatar'});
 const result=await uploadAsset({file,role:'avatar',key:crypto.randomUUID(),draftId:draft.id,signal:new AbortController().signal});
 await uploadApi('/api/upload-drafts/'+draft.id+'/avatar','POST');
 return result.asset.delivery_path!;
}
/** Banner de la ficha de creador: mismo recorrido que el avatar; devuelve la ruta que queda en `creator_profiles.banner_url`. */
export async function uploadBanner(file:File) {
 const {managedDraftSchema,uploadManagedAsset}=await import('./managed-browser');
 const {data:{session}}=await getSupabaseBrowserClient().auth.getSession();if(!session)throw new Error('Inicia sesión');
 const created=await uploadApi<{draft:unknown}>('/api/upload-drafts','POST',{purpose:'banner'});
 const draft=managedDraftSchema.parse(created.draft);
 const ready=await uploadManagedAsset({file,role:'banner',draft,idempotencyKey:crypto.randomUUID(),signal:new AbortController().signal});
 await uploadApi('/api/upload-drafts/'+draft.id+'/banner','POST');
 return `/api/media/${ready.asset.mediaId}`;
}
