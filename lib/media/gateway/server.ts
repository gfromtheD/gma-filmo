import { createServer,type IncomingMessage,type ServerResponse } from 'node:http';
import { z } from 'zod';
import { MediaError,mediaErrorResponse } from '../errors';
import { transfer,type GatewayDependencies } from './transfer';
export type GatewayDelivery=(request:IncomingMessage,response:ServerResponse,url:URL)=>Promise<void>;
export function createMediaGateway(deps:GatewayDependencies,delivery?:GatewayDelivery){
  return createServer((request,response)=>{void (async()=>{
    response.setHeader('Cache-Control','private, no-store');response.setHeader('X-Content-Type-Options','nosniff');
    const origin=request.headers.origin;
    if(origin){if(!deps.origins.includes(origin))throw new MediaError('UPLOAD_UNAUTHORIZED',{status:403});
      response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');
      response.setHeader('Access-Control-Expose-Headers','Range, Content-Range, Content-Length, Accept-Ranges');}
    const url=new URL(request.url??'','http://127.0.0.1');
    if(url.pathname==='/health' && request.method==='GET'){response.setHeader('Content-Type','application/json');response.end('{"ok":true}');return;}
    if(request.method==='OPTIONS'){
      if(!origin || !['PUT','GET','HEAD'].includes(String(request.headers['access-control-request-method'])))throw new MediaError('UPLOAD_UNAUTHORIZED',{status:403});
      const allowed=['authorization','content-type','content-range','range'];
      if(String(request.headers['access-control-request-headers']??'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean).some(h=>!allowed.includes(h)))throw new MediaError('UPLOAD_UNAUTHORIZED',{status:403});
      response.setHeader('Access-Control-Allow-Methods','PUT, GET, HEAD, OPTIONS');response.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Content-Range, Range');response.statusCode=204;response.end();return;
    }
    const match=/^\/(transfer|auxiliary)\/([^/]+)$/.exec(url.pathname);
    if(match && request.method==='PUT'){await transfer(request,response,z.string().uuid().parse(match[2]),match[1]==='auxiliary',deps);return;}
    if(delivery && (request.method==='GET'||request.method==='HEAD')){await delivery(request,response,url);return;}
    throw new MediaError('UPLOAD_NOT_FOUND');
  })().catch((error:unknown)=>{
    if(response.headersSent){response.destroy();return;}
    const known=error instanceof MediaError?error:null;
    const object=error && typeof error==='object'?error as {status?:unknown;code?:unknown}:null;
    const status=known?.status??(typeof object?.status==='number'?object.status:error instanceof z.ZodError?400:503);
    response.statusCode=status;response.setHeader('Content-Type','application/json');
    response.end(JSON.stringify(mediaErrorResponse(known??new MediaError(status===400?'UPLOAD_INVALID_INPUT':'MEDIA_PROVIDER_UNAVAILABLE',{status}))));
  });});
}
export function assertLocalGateway(env:Record<string,string|undefined>){
  if(env.UPLOAD_ENVIRONMENT!=='local'||env.MEDIA_MOCK_ENABLED!=='true'||env.PEERTUBE_PROVIDER_ENABLED==='true'||new URL(env.SUPABASE_URL??'invalid').hostname!=='127.0.0.1'
    || env.MEDIA_GATEWAY_URL!=='http://127.0.0.1:4319')throw new Error('MEDIA_GATEWAY_LOCAL_ONLY');
}
