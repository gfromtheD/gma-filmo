/** LOCAL diagnostic only. Generates authenticated traffic against real product APIs and gateway. */
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localEnvironment, localLogin } from './local-tools';
import { uploadMutationEnvelopeSchema } from '../../lib/media/contracts';
import { managedDraftSchema } from '../../lib/uploads/managed-browser';
import { playbackSourceSchema } from '../../lib/media/contracts';

export function localLoadOptions(args: string[]) {
  const options: Record<string,string> = {};
  for(let i=0;i<args.length;i+=2) {
    if(!['--viewers','--duration','--scenario'].includes(args[i]!) || !args[i+1] || options[args[i]!]) throw new Error('MEDIA_LOAD_ARGUMENTS_INVALID');
    options[args[i]!]=args[i+1]!;
  }
  const viewers=Number(options['--viewers']),duration=Number(options['--duration']);
  if(!Number.isInteger(viewers)||viewers<1||viewers>200||!Number.isInteger(duration)||duration<1||duration>3600||options['--scenario']!=='local-fixture') throw new Error('MEDIA_LOAD_LOCAL_FIXTURE_REQUIRED');
  return {viewers,duration,scenario:'local-fixture'};
}
export function deliveryUrl(value:string,base:string):URL {
  const url=new URL(value,base);
  if(url.origin!=='http://127.0.0.1:4319'||!url.pathname.startsWith('/playback/')||url.username||url.password||url.hash)throw new Error('MEDIA_LOAD_GATEWAY_ONLY');
  return url;
}
export function loadPlaylist(text:string,base:string) {
  if(!text.startsWith('#EXTM3U')||text.length>1024*1024)throw new Error('MEDIA_LOAD_INVALID_HLS');
  const resources:{url:URL;seconds:number}[]=[]; let seconds=0;
  for(const line of text.split(/\r?\n/)) {
    if(line.startsWith('#EXTINF:')) {seconds=Number(line.slice(8).split(',')[0]);if(!Number.isFinite(seconds)||seconds<=0||seconds>120)throw new Error('MEDIA_LOAD_INVALID_EXTINF');}
    else if(line.startsWith('#EXT-X-MAP:')) {const uri=/URI="([^"]+)"/.exec(line)?.[1];if(!uri)throw new Error('MEDIA_LOAD_INVALID_MAP');resources.push({url:deliveryUrl(uri,base),seconds:0});}
    else if(line && !line.startsWith('#')) {resources.push({url:deliveryUrl(line,base),seconds});seconds=0;}
  }
  if(!resources.length||resources.length>10000)throw new Error('MEDIA_LOAD_INVALID_HLS');
  return resources;
}
export async function runLocalLoad(args:string[]) {
  const options=localLoadOptions(args), environment=await localEnvironment(), token=await localLogin(environment);
  const web='http://127.0.0.1:4318';
  async function command(relative:string,method='GET',body?:unknown) {
    const response=await fetch(web+relative,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw new Error(`MEDIA_LOAD_PRODUCT_HTTP_${response.status}`);return response.json() as Promise<unknown>;
  }
  const created=await command('/api/upload-drafts','POST',{purpose:'title'});
  if(!created||typeof created!=='object'||!('draft'in created))throw new Error('MEDIA_LOAD_DRAFT_INVALID');
  const draft=managedDraftSchema.parse(created.draft);
  try {
    const bytes=await readFile('tests/media/fixtures/hls/legacy.mp4');
    let envelope=uploadMutationEnvelopeSchema.parse(await command('/api/uploads','POST',{draft_id:draft.id,revision:draft.revision,role:'main',bytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),file_name:'load-fixture.mp4',content_type:'video/mp4',idempotency_key:randomUUID()}));
    if(envelope.transfer?.protocol!=='uploadx'||new URL(envelope.transfer.url).origin!=='http://127.0.0.1:4319')throw new Error('MEDIA_LOAD_LOCAL_UPLOADX_REQUIRED');
    const ingested=await fetch(envelope.transfer.url,{method:'PUT',redirect:'error',headers:{...envelope.transfer.headers,'Content-Range':`bytes 0-${bytes.length-1}/${bytes.length}`},body:bytes,signal:AbortSignal.timeout(15000)});
    if(ingested.status!==200)throw new Error('MEDIA_LOAD_INGEST_FAILED');
    await command(`/api/uploads/${envelope.session.sessionId}/complete`,'POST',{generation:envelope.session.transferGeneration});
    const deadline=Date.now()+60000;
    while(envelope.asset.status!=='ready') {
      if(Date.now()>deadline||envelope.asset.status==='failed')throw new Error('MEDIA_LOAD_READY_TIMEOUT');
      await new Promise(resolve=>setTimeout(resolve,250));envelope=uploadMutationEnvelopeSchema.parse(await command(`/api/uploads/${envelope.session.sessionId}`));
    }
    const samples:{viewer:number;resource:string;status:number;bytes:number;latencyMs:number}[]=[];
    let renewals=0;
    const viewers = await Promise.allSettled(Array.from({length:options.viewers},async(_,viewer)=>{
      const end=Date.now()+options.duration*1000; let source=playbackSourceSchema.parse(await command(`/api/media/${envelope.asset.mediaId}/playback`));
      async function resource(url:URL,kind:string) {
        const started=performance.now();const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});const bytes=await response.arrayBuffer();
        samples.push({viewer,resource:kind,status:response.status,bytes:bytes.byteLength,latencyMs:Math.round((performance.now()-started)*100)/100});
        if(!response.ok)throw new Error(`MEDIA_LOAD_HTTP_${response.status}`);return new TextDecoder().decode(bytes);
      }
      while(Date.now()<end) {
        if(source.kind!=='hls')throw new Error('MEDIA_LOAD_HLS_REQUIRED');
        if(source.expiresAt!==null && source.expiresAt<Date.now()+60000){source=playbackSourceSchema.parse(await command(`/api/media/${envelope.asset.mediaId}/playback`));renewals++;continue;}
        const master=deliveryUrl(source.url,web);const variants=loadPlaylist(await resource(master,'master'),master.href);
        const variant=variants.find(r=>r.url.pathname.endsWith('.m3u8'));if(!variant)throw new Error('MEDIA_LOAD_VARIANT_REQUIRED');
        const segments=loadPlaylist(await resource(variant.url,'variant'),variant.url.href);
        for(const segment of segments) {
          if(Date.now()>=end)break;await resource(segment.url,segment.seconds?'segment':'init');
          if(segment.seconds)await new Promise(resolve=>setTimeout(resolve,Math.min(segment.seconds*1000,Math.max(0,end-Date.now()))));
        }
      }
    }));
    const failedViewers=viewers.filter(viewer=>viewer.status==='rejected').length;
    const report={...options,failedViewers,environment:'local',certifiesCapacity:false,renewals,requests:samples.length,errors:samples.filter(s=>s.status>=400).length,
      bytes:samples.reduce((n,s)=>n+s.bytes,0),samples};
    await mkdir('work/media-local/reports',{recursive:true});
    await writeFile('work/media-local/reports/load-hls.json',JSON.stringify(report,null,2)+'\n');
    await writeFile('work/media-local/reports/load-hls.csv','viewer,resource,status,bytes,latencyMs\n'+samples.map(s=>`${s.viewer},${s.resource},${s.status},${s.bytes},${s.latencyMs}`).join('\n')+'\n');
    console.log(JSON.stringify({...report,samples:undefined}));if(failedViewers)throw new Error('MEDIA_LOAD_VIEWERS_FAILED');return report;
  } finally {await command(`/api/upload-drafts/${draft.id}`,'DELETE');}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))void runLocalLoad(process.argv.slice(2)).catch(()=>{console.error('MEDIA_LOCAL_LOAD_FAILED');process.exitCode=1;});
