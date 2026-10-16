import {createPrivateKey,createPublicKey,sign,verify,randomUUID,type KeyObject} from 'node:crypto';
import {z} from 'zod';
import type {MediaCapabilityInput,MediaCapabilityIssuer} from './provider';
import {MediaError} from './errors';
const seconds=z.number().int().nonnegative().safe();
export const capabilityHeaderSchema=z.object({alg:z.literal('EdDSA'),typ:z.literal('JWT'),kid:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)}).strict();
export const capabilityClaimsSchema=z.object({iss:z.literal('gma'),aud:z.literal('gma-media-gateway'),iat:seconds,nbf:seconds,exp:seconds,
 sessionId:z.string().uuid(),assetId:z.string().uuid(),generation:z.number().int().positive().safe(),scope:z.enum(['upload','playback','auxiliary']),method:z.enum(['PUT','GET']),
 namespace:z.string().max(150),expectedBytes:z.number().int().positive().safe(),jti:z.string().uuid()}).strict().superRefine((c,ctx)=>{
 const namespace=c.scope==='upload'?`transfer/${c.sessionId}/${c.generation}/`:`asset/${c.assetId}/${c.generation}/`;
 if(c.namespace!==namespace || c.method!==(c.scope==='upload'?'PUT':'GET') || c.exp<=c.iat || c.nbf!==c.iat || c.exp-c.iat>(c.scope==='upload'?900:300))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Invalid capability bounds'});
});
export type MediaCapabilityClaims=z.infer<typeof capabilityClaimsSchema>;
const denied=()=>new MediaError('UPLOAD_UNAUTHORIZED');
function keyType(key:KeyObject){if(key.asymmetricKeyType!=='ed25519')throw denied();return key;}
export class Ed25519MediaCapabilityIssuer implements MediaCapabilityIssuer {
 private readonly key:KeyObject;
 constructor(privateKey:string|KeyObject,readonly kid:string,private readonly clock=()=>Date.now()) {
  capabilityHeaderSchema.parse({alg:'EdDSA',typ:'JWT',kid});this.key=keyType(typeof privateKey==='string'?createPrivateKey(privateKey):privateKey);
 }
 issue(input:MediaCapabilityInput) {
  if(!Number.isInteger(input.ttlSeconds) || input.ttlSeconds<1 || input.ttlSeconds>(input.scope==='upload'?900:300))throw denied();
  const now=Math.floor(this.clock()/1000);const {ttlSeconds,...claims}=input;
  const body=capabilityClaimsSchema.parse({...claims,iss:'gma',aud:'gma-media-gateway',iat:now,nbf:now,exp:now+ttlSeconds,jti:randomUUID()});
  const header=Buffer.from(JSON.stringify({alg:'EdDSA',typ:'JWT',kid:this.kid})).toString('base64url');const payload=Buffer.from(JSON.stringify(body)).toString('base64url');
  const data=`${header}.${payload}`;return {token:`${data}.${sign(null,Buffer.from(data),this.key).toString('base64url')}`,expiresAt:body.exp*1000};
 }
}
export interface CapabilityRequest {
 sessionId:string;assetId:string;generation:number;scope:MediaCapabilityClaims['scope'];method:'PUT'|'GET'|'HEAD';resourcePath:string;expectedBytes:number;
}
/** authorize is mandatory: signature is not a replacement for current SQL ownership/state/generation. */
export async function verifyMediaCapability(token:string,request:CapabilityRequest,keys:Readonly<Record<string,string|KeyObject>>,
 authorize:(claims:MediaCapabilityClaims)=>Promise<boolean>,clock=()=>Date.now()):Promise<MediaCapabilityClaims> {
 try {
  if(Buffer.byteLength(token)>4096)throw denied();const parts=token.split('.');if(parts.length!==3 || parts.some(p=>!p || !/^[a-zA-Z0-9_-]+$/.test(p)))throw denied();
  const header=capabilityHeaderSchema.parse(JSON.parse(Buffer.from(parts[0]!,'base64url').toString('utf8')) as unknown);
  if(!Object.prototype.hasOwnProperty.call(keys,header.kid))throw denied();const selected=keys[header.kid]!;const publicKey=keyType(typeof selected==='string'?createPublicKey(selected):selected);
  if(!verify(null,Buffer.from(`${parts[0]}.${parts[1]}`),publicKey,Buffer.from(parts[2]!,'base64url')))throw denied();
  const claims=capabilityClaimsSchema.parse(JSON.parse(Buffer.from(parts[1]!,'base64url').toString('utf8')) as unknown);const now=Math.floor(clock()/1000);
  if(claims.nbf>now+30 || claims.iat>now+30 || claims.exp<=now-30)throw denied();
  const method=request.method==='HEAD'?'GET':request.method;
  if(claims.sessionId!==request.sessionId || claims.assetId!==request.assetId || claims.generation!==request.generation || claims.scope!==request.scope || claims.method!==method || claims.expectedBytes!==request.expectedBytes)throw denied();
  if(!request.resourcePath.startsWith(claims.namespace) || !/^[a-zA-Z0-9_./-]+$/.test(request.resourcePath) || request.resourcePath.split('/').some(part=>!part || part==='.' || part==='..'))throw denied();
  if(!await authorize(claims))throw denied();return claims;
 }catch{throw denied();}
}
export function getMediaCapabilityIssuer():MediaCapabilityIssuer {
 const pem=process.env.MEDIA_CAPABILITY_PRIVATE_KEY?.replace(/\\n/g,'\n');const kid=process.env.MEDIA_CAPABILITY_KEY_ID;
 if(!pem || !kid)throw new MediaError('MEDIA_PROVIDER_UNAVAILABLE');return new Ed25519MediaCapabilityIssuer(pem,kid);
}
