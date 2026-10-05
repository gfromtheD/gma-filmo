import path from 'node:path';
import {safeMediaPath} from './video-processing';
import {UploadError} from './repository';
import type {MediaAsset} from './types';
export function hlsObject(asset:MediaAsset,relative:string) {
 safeMediaPath(relative);
 const prefix=asset.metadata.hls_prefix;
 const outputs=asset.metadata.outputs as Array<{relative:string;bytes:number;mime:string}>|undefined;
 if(typeof prefix!=='string'||!prefix.startsWith('media/'+asset.id+'/hls/')||!outputs?.some(o=>o.relative===relative))throw new UploadError('UPLOAD_NOT_FOUND',404);
 return prefix+relative;
}
export function rewritePlaylist(asset:MediaAsset,relative:string,content:string) {
 if(content.length>1024**2||!content.startsWith('#EXTM3U')||/URI\s*=/.test(content))throw new UploadError('UPLOAD_INVALID_ASSET',503);
 return content.split('\n').map(line=>{
  if(!line||line.startsWith('#'))return line;
  const target=path.posix.join(path.posix.dirname(relative),safeMediaPath(line));hlsObject(asset,target);
  return '/api/media/'+asset.id+'/hls/'+target.split('/').map(encodeURIComponent).join('/');
 }).join('\n');
}
