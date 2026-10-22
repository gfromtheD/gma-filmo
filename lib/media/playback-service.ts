import {z} from 'zod';
import {gatewayCapToken} from './delivery-token';
import {createHash} from 'node:crypto';
import {MediaService} from './service';
import {MediaRepository} from './repository';
import type {MediaProviderRegistry} from './registry';
import {MediaError} from './errors';
import {playbackSourceSchema,mediaUrlSchema} from './contracts';
import {legacyMediaUrl,resolveLegacyPlayback} from './legacy-playback';
import type {ProviderPlaybackContext} from './provider';
import {safeMediaPath} from '@/lib/uploads/video-processing';
const notFound=()=>new MediaError('MEDIA_NOT_FOUND');
// Imágenes de títulos publicados: el CDN guarda la redirección 1 h y el navegador 5 min. Debe quedar por debajo de la caducidad de la URL firmada (24 h)
// aunque se sirva obsoleta (1 h + 10 min de gracia). Si un archivo se sustituye cambia de id, así que nunca se ve una imagen vieja bajo el mismo enlace.
const PUBLIC_IMAGE_CACHE='public, max-age=300, s-maxage=3600, stale-while-revalidate=600';
const CACHEABLE_IMAGE_ROLES=['poster','poster_h','poster_v','extra_image'];
export class PlaybackService {
 readonly service:MediaService;
 constructor(readonly repo=new MediaRepository(),registry?:MediaProviderRegistry){this.service=new MediaService(repo,registry);}
 private async title(slug:string,owner:string|null) {
  const row=await this.repo.title(slug);
  if(row.media_delete_state && row.media_delete_state!=='none' || row.status && row.status!=='published' && !(row.status==='unpublished' && owner && row.creator_user_id===owner))throw notFound();
  return row;
 }
 private async context(id:string,owner:string|null,slug:string|null=null) {
  await this.repo.authorizePlayback(id,owner,slug);const session=await this.repo.assetSession(id);return this.service.context(session.id);
 }
 private base(context:Awaited<ReturnType<MediaService['context']>>,title:Record<string,unknown>|null):ProviderPlaybackContext {
  return {...context,authorization:title?'published-title':'owner-preview',titleSlug:title?String(title.slug):null,titleId:title?Number(title.id):null,titleRevision:title?Number(title.media_revision??0):null,subtitles:[],posterUrl:null,thumbnails:null,fallback:null};
 }
 private async legacyFallback(title:Record<string,unknown>):Promise<string|null> {
  const id=Number(title.id),owner=String(title.creator_user_id);if(!Number.isSafeInteger(id)||id<1||!z.string().uuid().safeParse(owner).success)return null;
  const now=Date.now();const versions=await this.repo.titleVersions(id,owner);
  for(const version of versions.reverse()) {
   if(version.owner_id!==owner||Date.parse(version.retained_until)<=now||version.snapshot.playback_kind!=='legacy')continue;
   const url=legacyMediaUrl(version.snapshot.r2_video_url);if(url)return url;
  }
  return null;
 }
 async resolveLegacyFallback(slug:string,owner:string|null):Promise<string> {
  const title=await this.title(slug,owner);if(title.status!=='published'||title.media_delete_state!=='none')throw notFound();
  const url=await this.legacyFallback(title);if(!url)throw notFound();return url;
 }
 private async registerDelivery(url:string,expiresAt:number|null,context:Awaited<ReturnType<MediaService['context']>>,owner:string|null,titleSlug:string|null){
  const token=gatewayCapToken(url);if(!token)return;
  if(!expiresAt)throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
  await this.repo.registerGatewayGrant(owner,context.asset.id,context.processingGeneration,titleSlug?null:context.session.draft_id,titleSlug,
   createHash('sha256').update(token).digest('hex'),new Date(expiresAt).toISOString());
 }
 /**
  * Motor apagado (o base sin migrar): resuelve solo la reproducción histórica (MP4 de R2 / YouTube) leyendo `peliculas`,
  * sin tocar tablas `gma_*`. Misma regla de visibilidad que `resolveTitle`.
  */
 async resolveLegacyOnly(slug:string,owner:string|null) {
  const title=await this.title(slug,owner);
  if(title.playback_kind && title.playback_kind!=='legacy')throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
  return resolveLegacyPlayback(title);
 }
 async resolveTitle(slug:string,owner:string|null) {
  const title=await this.title(slug,owner);const junction=await this.repo.titleMedia(z.number().int().positive().parse(title.id));
  const mains=junction.filter(m=>m.role==='main' && m.slot==='main');
  if(mains.length===0) {
    if(title.playback_kind && title.playback_kind!=='legacy')throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
    return resolveLegacyPlayback(title);
  }
  if(mains.length!==1)throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
  const context=this.base(await this.context(mains[0]!.asset_id,owner,slug),title);
  if(await this.legacyFallback(title))context.fallback={kind:'mp4',url:`/api/titles/${encodeURIComponent(slug)}/legacy-fallback`};
  const auxiliary=await this.resolveAuxiliaries(slug,owner);
  context.subtitles=auxiliary.media.filter(m=>m.role==='subtitles' && m.url).map((m,i)=>({id:m.mediaId,language:m.language??'und',label:m.language??'Subtítulos',url:m.url!,default:i===0,format:'vtt' as const}));
  context.posterUrl=auxiliary.media.find(m=>['poster','poster_h','poster_v'].includes(m.role))?.url??null;
  const source=playbackSourceSchema.parse(await this.service.registry.get(context.asset.provider).getPlayback(context));
  if(source.kind!=='youtube')await this.registerDelivery(source.url,source.expiresAt,context,owner,slug);return source;
 }
 async resolvePreview(id:string,owner:string) {
  const context=await this.context(id,owner);if(context.asset.owner_id!==owner)throw notFound();
  const draft=await this.repo.draft(owner,context.session.draft_id);if(draft.state!=='draft' || !await this.repo.draftContains(draft.id,id))throw notFound();
  const source=playbackSourceSchema.parse(await this.service.registry.get(context.asset.provider).getPlayback(this.base(context,null)));
  if(source.kind!=='youtube')await this.registerDelivery(source.url,source.expiresAt,context,owner,null);return source;
 }
 /** Reproducción de UN vídeo auxiliar (tráiler, extra o intro) de un título publicado: lo que abre el visor de extras de la ficha. */
 async resolveTitleVideo(slug:string,assetId:string,owner:string|null) {
  const title=await this.title(slug,owner);const junction=await this.repo.titleMedia(Number(title.id));
  const item=junction.find(m=>m.asset_id===assetId && ['trailer','extras','intro'].includes(m.role));
  if(!item)throw notFound();
  const context=this.base(await this.context(assetId,owner,slug),title);
  const source=playbackSourceSchema.parse(await this.service.registry.get(context.asset.provider).getPlayback(context));
  if(source.kind!=='youtube')await this.registerDelivery(source.url,source.expiresAt,context,owner,slug);return source;
 }
 async resolveAuxiliaries(slug:string,owner:string|null) {
  const title=await this.title(slug,owner);const junction=await this.repo.titleMedia(Number(title.id));
  const media=await Promise.all(junction.filter(m=>m.role!=='main').map(async m=>{
   const context=await this.context(m.asset_id,owner,slug);const provider=this.service.registry.get(context.asset.provider);
   const common={mediaId:m.asset_id,role:m.role,slot:m.slot,language:m.language,position:m.position};
   if(['trailer','extras','intro'].includes(m.role)){const source=playbackSourceSchema.parse(await provider.getPlayback(this.base(context,title)));if(source.kind!=='youtube')await this.registerDelivery(source.url,source.expiresAt,context,owner,slug);return {...common,source,url:source.kind==='youtube'?null:source.url,expiresAt:source.expiresAt};}
   const delivery=await provider.getAuxiliaryDelivery(context);await this.registerDelivery(delivery.url,delivery.expiresAt,context,owner,slug);return {...common,url:mediaUrlSchema.parse(delivery.url),expiresAt:delivery.expiresAt,source:null};
  }));return {version:1 as const,media};
 }
 async deliverAuxiliary(id:string,owner:string|null):Promise<Response> {
  const context=await this.context(id,owner);if(!['subtitles','poster','poster_h','poster_v','avatar','extra_image'].includes(context.asset.role))throw notFound();
  const provider=this.service.registry.get(context.asset.provider);
  const cacheable=CACHEABLE_IMAGE_ROLES.includes(context.asset.role) && await this.repo.isPublishedTitleAsset(id);
  if(provider.readAuxiliary){const result=await provider.readAuxiliary(context);if(result.bytes.byteLength>4*1024**2 || !['text/vtt','image/webp'].includes(result.mimeType))throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
   return new Response(Buffer.from(result.bytes),{headers:{'Content-Type':result.mimeType,'Cache-Control':cacheable?PUBLIC_IMAGE_CACHE:'private, no-store','X-Content-Type-Options':'nosniff'}});}
  const delivery=await provider.getAuxiliaryDelivery(context);await this.registerDelivery(delivery.url,delivery.expiresAt,context,owner,null);
  return new Response(null,{status:307,headers:{'Cache-Control':cacheable?PUBLIC_IMAGE_CACHE:'private, no-store',Location:mediaUrlSchema.parse(delivery.url)}});
 }
 async deliverHls(id:string,relative:string,owner:string|null):Promise<Response> {
  safeMediaPath(relative);const output=await this.repo.authorizedOutput(id,relative,owner);
  const session=await this.repo.assetSession(id);const context=await this.service.context(session.id,undefined,relative.endsWith('.m3u8'));
  const provider=this.service.registry.get(context.asset.provider);if(!provider.deliverHls)throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
  return provider.deliverHls(context,relative,output);
 }
}
