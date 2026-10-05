'use client';
import { useEffect,useState,type RefObject } from 'react';
export function useStreamPlayback(ref:RefObject<HTMLVideoElement>,slug:string,enabled:boolean) {
 const [source,setSource]=useState<{url:string;expiresAt:number}|null>(null);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
   if(!enabled){setSource(null);return;}
   let disposed=false,timer:ReturnType<typeof setTimeout>;const abort=new AbortController();
   const load=async()=>{
     try {
       const response=await fetch('/api/titles/'+encodeURIComponent(slug)+'/playback',{cache:'no-store',signal:abort.signal});
       if(!response.ok)throw new Error('No se pudo cargar el vídeo');
       const data=await response.json();if(disposed)return;
       if(data.kind!=='hls'||typeof data.url!=='string')throw new Error('Fuente de reproducción no válida');
       setSource(data);setError(null);
       timer=setTimeout(()=>void load(),Math.max(30000,data.expiresAt-Date.now()-60000));
     }catch{if(!disposed){setError('No se pudo cargar el vídeo. Vuelve a intentarlo.');timer=setTimeout(()=>void load(),30000);}}
   };setSource(null);void load();return()=>{disposed=true;abort.abort();clearTimeout(timer);};
 },[enabled,slug]);
 useEffect(()=>{
   if(!enabled||!source||!ref.current)return;
   const video=ref.current,position=video.currentTime,wasPlaying=!video.paused;
   let disposed=false,cleanup=()=>{};
   const restore=()=>{if(position>0)video.currentTime=position;if(wasPlaying)void video.play().catch(()=>{});};
   video.addEventListener('loadedmetadata',restore,{once:true});
   if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=source.url;}
   else void import('hls.js').then(({default:Hls})=>{
     if(disposed)return;if(!Hls.isSupported()){setError('Este navegador no admite la reproducción del vídeo');return;}
     const hls=new Hls({maxBufferLength:30,maxMaxBufferLength:60,backBufferLength:30});
     hls.loadSource(source.url);hls.attachMedia(video);
     hls.on(Hls.Events.ERROR,(_event,data)=>{if(!data.fatal)return;
       if(data.type===Hls.ErrorTypes.NETWORK_ERROR)hls.startLoad(video.currentTime);
       else if(data.type===Hls.ErrorTypes.MEDIA_ERROR)hls.recoverMediaError();
       else setError('La reproducción se ha interrumpido');
     });cleanup=()=>hls.destroy();
   });
   return()=>{disposed=true;cleanup();video.removeEventListener('loadedmetadata',restore);};
 },[enabled,source,ref]);
 return {url:source?.url??null,error};
}
