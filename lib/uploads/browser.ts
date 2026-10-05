'use client';
import { Upload } from 'tus-js-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { TUS_CHUNK_SIZE,UPLOAD_LIMITS } from './policy';
import type { UploadSession,MediaAsset,UploadDraft,AssetRole } from './types';
import type { ClientDraftResponse } from './client-models';

export async function uploadApi<T>(path:string,method='GET',body?:unknown):Promise<T> {
 const {data:{session}}=await getSupabaseBrowserClient().auth.getSession();
 if(!session)throw new Error('Inicia sesión para subir contenido');
 const response=await fetch(path,{method,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
 body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new Error(data.error??'No se pudo completar la operación');return data as T;
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
function put(file:File,url:string,signal:AbortSignal,progress:(n:number)=>void):Promise<void> {
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
 const url=session.provider_data.uploadUrl;if(typeof url!=='string' && !session.provider_data.transfer_complete)throw new Error('La sesión necesita recuperación del proveedor');
 input.onState?.('Transfiriendo');const progress=input.onProgress??(()=>{});
 if(!session.provider_data.transfer_complete){if(session.provider==='stream')await tus(file,String(url),session,signal,progress);else await put(file,String(url),signal,progress);}
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
 const {draft}=await uploadApi<{draft:UploadDraft}>('/api/upload-drafts','POST',{purpose:'avatar'});
 const result=await uploadAsset({file,role:'avatar',key:crypto.randomUUID(),draftId:draft.id,signal:new AbortController().signal});
 await uploadApi('/api/upload-drafts/'+draft.id+'/avatar','POST');
 return result.asset.delivery_path!;
}
