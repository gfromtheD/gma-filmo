import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {ProviderError} from './stream';

export interface VideoMetadata {duration:number;container:string;videoCodec:string;audioCodec:string|null;width:number;height:number;frameRate:number;channels:number;bitrate:number;streams:number;hasAudio:boolean}
export interface ProcessingOutput {relative:string;bytes:number;mime:string}
export interface ProcessedVideo {metadata:VideoMetadata;outputs:ProcessingOutput[];processedBytes:number;profiles:Array<{height:number;width:number;bitrate:number}>}
export interface MediaRunner {run(binary:'ffprobe'|'ffmpeg',args:string[],cwd:string,signal:AbortSignal,timeoutMs:number):Promise<string>}
export const PROCESSING_POLICY={version:'gma-hls-v1',threads:2,maxPixels:16_777_216,maxStreams:8,maxFps:120,
 maxTemporaryBytes:24*1024**3,maxOutputBytes:20*1024**3,maxOutputFiles:60000,wallTimeMs:6*3600*1000,
 profiles:[{height:1080,width:1920,bitrate:5_000_000},{height:720,width:1280,bitrate:2_800_000},{height:480,width:854,bitrate:1_200_000}]};

/** Production uses a separate OS namespace plus hard rlimits; local mode is fixture-only. */
export class IsolatedMediaRunner implements MediaRunner {
 constructor(private fixtureOnly=false){}
 async run(binary:'ffprobe'|'ffmpeg',args:string[],cwd:string,signal:AbortSignal,timeoutMs:number) {
  const executable=process.env[binary==='ffmpeg'?'FFMPEG_PATH':'FFPROBE_PATH']??'/usr/bin/'+binary;
  if(!path.isAbsolute(executable))throw new ProviderError('VIDEO_BINARY_PATH_INVALID');
  const local=this.fixtureOnly && process.env.UPLOAD_ENVIRONMENT==='local' && process.env.VIDEO_SANDBOX==='local-test';
  if(!local && (process.platform!=='linux'||process.env.VIDEO_SANDBOX!=='bubblewrap'))throw new ProviderError('VIDEO_SANDBOX_REQUIRED');
  const limiter=path.resolve('scripts/uploads/media-limit.py');
  const python=process.env.MEDIA_PYTHON_PATH??'/usr/bin/python3';
  const limits=['--cpu',String(Math.ceil(timeoutMs/1000)), '--memory',String(3*1024**3),'--file',String(512*1024**2),'--'];
  const command=local?python:'/usr/bin/bwrap';
  const argv=local?[limiter,...limits,executable,...args]:[
   '--unshare-all','--die-with-parent','--new-session','--ro-bind','/usr','/usr','--ro-bind','/lib','/lib',
   ...(process.arch==='x64'?['--ro-bind','/lib64','/lib64']:[]),'--proc','/proc','--dev','/dev','--tmpfs','/tmp',
   '--bind',cwd,'/work','--ro-bind',limiter,'/media-limit.py','--chdir','/work','--',python,'/media-limit.py',...limits,executable,...args];
  return new Promise<string>((resolve,reject)=>{
   let stdout='',finished=false,timedOut=false,outputExceeded=false;const child=spawn(command,argv,{cwd,stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',NODE_ENV:'production'},detached:true});
   const kill=()=>{try{process.kill(-child.pid!,'SIGKILL');}catch{child.kill('SIGKILL');}};
   const abort=()=>kill();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)kill();
   const timer=setTimeout(()=>{timedOut=true;kill();},timeoutMs);
   child.stdout.on('data',(chunk:Buffer)=>{stdout+=chunk.toString();if(stdout.length>2*1024**2){outputExceeded=true;kill();}});
   // Drain stderr without logging filenames, user content or provider secrets.
   child.stderr.resume();
   const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
   child.on('error',()=>{if(finished)return;finished=true;cleanup();reject(new ProviderError('VIDEO_BINARY_UNAVAILABLE'));});
   child.on('close',code=>{if(finished)return;finished=true;cleanup();if(code===0&&!signal.aborted)resolve(stdout);else reject(new ProviderError(signal.aborted?'VIDEO_INTERRUPTED':timedOut?'VIDEO_PROCESSING_TIMEOUT':outputExceeded?'VIDEO_TOOL_OUTPUT_TOO_LARGE':binary==='ffprobe'?'VIDEO_PROBE_FAILED':'VIDEO_TRANSCODE_FAILED'));});
  });
 }
}
const rational=(value:unknown)=>{const [a,b]=String(value).split('/').map(Number);return b?a!/b:a??0;};
export function parseProbe(raw:string,maxDuration:number):VideoMetadata {
 let data;try{data=JSON.parse(raw);}catch{throw new ProviderError('VIDEO_PROBE_INVALID');}
 const streams=data.streams??[],videos=streams.filter((s:Record<string,unknown>)=>s.codec_type==='video'&&!((s.disposition as Record<string,unknown>|undefined)?.attached_pic)),audios=streams.filter((s:Record<string,unknown>)=>s.codec_type==='audio');
 const v=videos[0],a=audios[0];const duration=Number(data.format?.duration),fps=rational(v?.avg_frame_rate);
 if(!v||videos.length!==1||streams.length>PROCESSING_POLICY.maxStreams||!Number.isFinite(duration)||duration<=0||duration>maxDuration
  ||(v.side_data_list??[]).some((d:{rotation?:number})=>d.rotation && Math.abs(d.rotation)%360!==0)
  ||!Number.isInteger(v.width)||!Number.isInteger(v.height)||v.width<16||v.height<16||v.width>8192||v.height>8192||v.width*v.height>PROCESSING_POLICY.maxPixels
  ||!Number.isFinite(fps)||fps<=0||fps>PROCESSING_POLICY.maxFps||['smpte2084','arib-std-b67'].includes(v.color_transfer))throw new ProviderError('VIDEO_METADATA_INVALID');
 return {duration,container:String(data.format.format_name),videoCodec:String(v.codec_name),audioCodec:a?String(a.codec_name):null,
  width:v.width,height:v.height,frameRate:fps,channels:Number(a?.channels??0),bitrate:Number(data.format.bit_rate)||0,streams:streams.length,hasAudio:!!a};
}
export function selectProfiles(metadata:VideoMetadata) {
 const targets=PROCESSING_POLICY.profiles.filter(p=>metadata.height>=p.height);
 const selected=targets.length?targets:[{height:metadata.height,width:metadata.width,bitrate:800_000}];
 const seen=new Set<string>();
 return selected.map(p=>{const scale=Math.min(1,p.width/metadata.width,p.height/metadata.height);return {...p,width:Math.max(2,Math.floor(metadata.width*scale/2)*2),height:Math.max(2,Math.floor(metadata.height*scale/2)*2)};}).filter(p=>{const key=p.width+'x'+p.height;if(seen.has(key))return false;seen.add(key);return true;});
}
export function safeMediaPath(relative:string) {
 if(!/^[a-zA-Z0-9_./-]+$/.test(relative)||relative.startsWith('/')||relative.split('/').some(s=>!s||s==='.'||s==='..'))throw new ProviderError('VIDEO_OUTPUT_PATH_INVALID');return relative;
}
export async function directoryBytes(root:string):Promise<number> {
 let total=0;for(const entry of await readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isSymbolicLink())throw new ProviderError('VIDEO_OUTPUT_INVALID');total+=entry.isDirectory()?await directoryBytes(file):(await stat(file)).size;}return total;
}
export async function verifyHls(root:string,metadata:VideoMetadata,profiles:ReturnType<typeof selectProfiles>):Promise<ProcessingOutput[]> {
 const outputs:ProcessingOutput[]=[];
 const add=async(relative:string,mime:string)=>{safeMediaPath(relative);const info=await stat(path.join(root,relative));if(!info.isFile()||info.size<=0||info.size>512*1024**2)throw new ProviderError('VIDEO_OUTPUT_INVALID');outputs.push({relative,bytes:info.size,mime});};
 const master=await readFile(path.join(root,'master.m3u8'),'utf8');if(!master.startsWith('#EXTM3U'))throw new ProviderError('VIDEO_HLS_INCOMPLETE');
 const variants=master.split('\n').filter(l=>l&&!l.startsWith('#'));
 if(variants.length!==profiles.length||variants.some((v,i)=>v!==i+'/index.m3u8'))throw new ProviderError('VIDEO_HLS_INCOMPLETE');
 await add('master.m3u8','application/vnd.apple.mpegurl');
 for(const variant of variants) {
  const content=await readFile(path.join(root,variant),'utf8');if(!content.startsWith('#EXTM3U')||!content.includes('#EXT-X-ENDLIST'))throw new ProviderError('VIDEO_HLS_INCOMPLETE');
  const lengths=Array.from(content.matchAll(/^#EXTINF:([\d.]+),/gm),m=>Number(m[1]));
  if(!lengths.length||lengths.some(d=>!Number.isFinite(d)||d<=0)||Math.abs(lengths.reduce((a,b)=>a+b,0)-metadata.duration)>Math.max(2,metadata.duration*0.01))throw new ProviderError('VIDEO_HLS_INCOMPLETE');
  const segments=content.split('\n').filter(l=>l&&!l.startsWith('#'));if(segments.length!==lengths.length)throw new ProviderError('VIDEO_HLS_INCOMPLETE');
  await add(variant,'application/vnd.apple.mpegurl');
  for(const segment of segments){if(!/^segment-\d+\.ts$/.test(segment))throw new ProviderError('VIDEO_HLS_INCOMPLETE');await add(path.posix.dirname(variant)+'/'+segment,'video/mp2t');}
 }
 await add('poster.jpg','image/jpeg');
 if(outputs.length>PROCESSING_POLICY.maxOutputFiles||outputs.reduce((n,o)=>n+o.bytes,0)>PROCESSING_POLICY.maxOutputBytes)throw new ProviderError('VIDEO_OUTPUT_TOO_LARGE');
 return outputs;
}
export class VideoProcessor {
 constructor(private runner:MediaRunner=new IsolatedMediaRunner()){}
 async probe(cwd:string,filename:string,maxDuration:number,signal:AbortSignal) {
  const raw=await this.runner.run('ffprobe',['-v','error','-max_alloc','268435456','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,avi,mpegts,mpeg,ogg,flv',
   '-show_streams','-show_format','-of','json',filename],cwd,signal,60000);
  return parseProbe(raw,maxDuration);
 }
 async process(cwd:string,metadata:VideoMetadata,signal:AbortSignal):Promise<ProcessedVideo> {
  const profiles=selectProfiles(metadata);await mkdir(path.join(cwd,'output'),{recursive:true});
  let master='#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-INDEPENDENT-SEGMENTS\n';
  for(let i=0;i<profiles.length;i++){
   const p=profiles[i]!;await mkdir(path.join(cwd,'output',String(i)),{recursive:true});
   const common=['-nostdin','-hide_banner','-v','error','-xerror','-max_alloc','268435456','-y','-noautorotate','-threads',String(PROCESSING_POLICY.threads),'-filter_threads','1',
    '-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,avi,mpegts,mpeg,ogg,flv','-i','source','-map','0:v:0','-map','0:a:0?',
    '-map_metadata','-1','-sn','-dn','-vf',`scale=${p.width}:${p.height},setsar=1`,'-r',String(Math.min(30,metadata.frameRate)),
    '-c:v','libx264','-threads',String(PROCESSING_POLICY.threads),'-preset','fast','-pix_fmt','yuv420p','-b:v',String(p.bitrate),'-maxrate',String(p.bitrate*1.2),'-bufsize',String(p.bitrate*2),
    '-force_key_frames','expr:gte(t,n_forced*6)','-sc_threshold','0','-c:a','aac','-b:a','128k','-ac','2','-ar','48000',
    '-f','hls','-hls_time','6','-hls_playlist_type','vod','-hls_flags','independent_segments+temp_file','-hls_segment_filename',`output/${i}/segment-%06d.ts`,`output/${i}/index.m3u8`];
   await this.runner.run('ffmpeg',common,cwd,signal,PROCESSING_POLICY.wallTimeMs);
   // Decode every generated segment through the finished playlist; exit success alone is insufficient.
   await this.runner.run('ffmpeg',['-nostdin','-v','error','-xerror','-threads','2','-protocol_whitelist','file,pipe','-i',`output/${i}/index.m3u8`,'-map','0:v:0','-map','0:a:0?','-f','null','-'],cwd,signal,Math.min(PROCESSING_POLICY.wallTimeMs,Math.max(60000,metadata.duration*2000)));
   master+=`#EXT-X-STREAM-INF:BANDWIDTH=${Math.ceil(p.bitrate*1.2+128000)},RESOLUTION=${p.width}x${p.height}\n${i}/index.m3u8\n`;
  }
  await this.runner.run('ffmpeg',['-nostdin','-v','error','-xerror','-max_alloc','268435456','-y','-noautorotate','-threads','2','-protocol_whitelist','file,pipe','-i','source','-ss',String(Math.min(1,metadata.duration/2)),'-map','0:v:0','-frames:v','1','-vf',`scale=${Math.min(640,metadata.width)}:-2`,'-q:v','3','output/poster.jpg'],cwd,signal,60000);
  await writeFile(path.join(cwd,'output','master.m3u8'),master);
  const outputs=await verifyHls(path.join(cwd,'output'),metadata,profiles);
  return {metadata,outputs,profiles,processedBytes:outputs.reduce((n,o)=>n+o.bytes,0)};
 }
}
