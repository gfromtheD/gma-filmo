import {MediaError} from './errors';
import {playbackSourceSchema} from './contracts';
import type {PlaybackSource} from '@/types/playback';
export function legacyMediaUrl(value:unknown,env:Record<string,string|undefined>=process.env):string|null {
 if(typeof value!=='string' || !value || /[\\\u0000-\u0020]/.test(value))return null;
 try {
  const parsed=new URL(value);if(parsed.username || parsed.password || parsed.hash)return null;
  const allowed=new Set((env.LEGACY_MEDIA_ALLOWED_HOSTS??'').split(',').map(x=>x.trim()).filter(Boolean));
  const configured=new URL(env.NEXT_PUBLIC_R2_PUBLIC_URL||'https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev');allowed.add(configured.hostname);
  if(parsed.protocol==='https:' && (!parsed.port || parsed.port==='443') && allowed.has(parsed.hostname))return parsed.href;
  if(env.UPLOAD_ENVIRONMENT==='local' && env.MEDIA_MOCK_ENABLED==='true' && env.SUPABASE_URL && ['127.0.0.1','localhost','[::1]'].includes(new URL(env.SUPABASE_URL).hostname)
   && parsed.origin==='http://127.0.0.1:4319' && ['/fixtures/legacy.mp4','/fixtures/subtitles.es.vtt','/fixtures/subtitles.en.vtt','/fixtures/poster.webp','/fixtures/legacy.es.vtt','/fixtures/legacy.en.vtt','/fixtures/legacy.poster.webp'].includes(parsed.pathname) && !parsed.search)return parsed.href;
  return null;
 }catch{return null;}
}
export function legacyYouTubeId(value:unknown):string|null {
 if(typeof value!=='string')return null;try {
  const url=new URL(value);if(url.protocol!=='https:' || url.username || url.password || url.port)return null;
  const host=url.hostname;let id:string|null=null;
  if(host==='youtu.be')id=url.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){
   if(url.pathname==='/watch')id=url.searchParams.get('v');else id=/^\/(?:embed|shorts)\/([^/]+)$/.exec(url.pathname)?.[1]??null;
  }
  return id && /^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;
 }catch{return null;}
}
export function resolveLegacyPlayback(row:Record<string,unknown>,env:Record<string,string|undefined>=process.env):PlaybackSource {
 const slug=String(row.slug),url=legacyMediaUrl(row.r2_video_url,env),youtube=legacyYouTubeId(row.youtube_url);
 const rawSubtitle=legacyMediaUrl(row.r2_subtitle_url,env);
 const subtitle=rawSubtitle?`/api/subtitle-proxy?url=${encodeURIComponent(rawSubtitle)}`:null;
 const spriteImage=url && /^[\w-]+$/.test(slug) ? legacyMediaUrl(new URL(`/sprites/${encodeURIComponent(slug)}.jpg`,url).href,env) : null;
 const sprites=spriteImage ? { vttUrl:`/api/sprites/${encodeURIComponent(slug)}`,imageUrl:spriteImage,tileWidth:160,tileHeight:90 } : null;
 const common={version:1 as const,mediaId:null,titleId:Number(row.id),titleSlug:slug,revision:Number(row.media_revision??0),expiresAt:null,refreshUrl:`/api/titles/${encodeURIComponent(slug)}/playback`,
  subtitles:subtitle?[{id:'legacy',language:'und',label:'Subtítulos',url:subtitle,default:true,format:'vtt' as const}]:[],posterUrl:legacyMediaUrl(row.r2_poster_url??row.thumbnail_url,env),thumbnails:sprites};
 if(url)return playbackSourceSchema.parse({...common,kind:'mp4',url,mimeType:'video/mp4'});
 if(youtube)return playbackSourceSchema.parse({...common,kind:'youtube',videoId:youtube});
 throw new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');
}
