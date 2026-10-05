import type {UploadSession,MediaAsset} from './types';
export interface StoredObject {key:string;bytes:number}
/** Read-only classification; deletion stays behind durable ownership and quota gates. */
export function classifyStorage(sessions:UploadSession[],assets:MediaAsset[],objects:StoredObject[],activePrefixes:string[]) {
 const sessionKeys=new Map(sessions.filter(s=>s.object_key).map(s=>[s.object_key!,s])),assetIds=new Map(assets.map(a=>[a.id,a]));
 const listed=new Map(objects.map(o=>[o.key,o.bytes]));
 const orphanOriginals:string[]=[],orphanDerivatives:string[]=[],receivedWithoutSql:string[]=[],incompleteReady:string[]=[];
 for(const object of objects) {
  if(object.key.startsWith('ingest/')){if(object.key.split('/').length!==4)continue;const s=sessionKeys.get(object.key);if(!s){orphanOriginals.push(object.key);continue;}if(['provisioning','uploading','paused'].includes(s.state))receivedWithoutSql.push(s.id);}
  else if(object.key.startsWith('media/')) {
   const a=assetIds.get(object.key.split('/')[1]!);if(!a||a.state==='deleted'){(object.key.includes('/original/')?orphanOriginals:orphanDerivatives).push(object.key);continue;}
   if(object.key===a.metadata.original_key||activePrefixes.some(p=>object.key.startsWith(p)))continue;
   const prefix=a.metadata.hls_prefix,outputs=a.metadata.outputs as Array<{relative:string}>|undefined;
   if(typeof prefix==='string'&&outputs?.some(o=>prefix+o.relative===object.key))continue;
   orphanDerivatives.push(object.key);
  }
 }
 for(const a of assets.filter(a=>a.provider==='r2'&&a.state==='ready'&&typeof a.metadata.hls_prefix==='string')) {
  const outputs=a.metadata.outputs as Array<{relative:string;bytes:number}>|undefined;
  if(!outputs?.length||outputs.some(o=>listed.get(String(a.metadata.hls_prefix)+o.relative)!==o.bytes))incompleteReady.push(a.id);
 }
 return {orphanOriginals,orphanDerivatives,receivedWithoutSql:[...new Set(receivedWithoutSql)],incompleteReady,
  physicalBytes:objects.reduce((n,o)=>n+o.bytes,0),objects:objects.length};
}
