import {test} from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {Ed25519MediaCapabilityIssuer,verifyMediaCapability,type CapabilityRequest} from '../../lib/media/capabilities';
const pair=generateKeyPairSync('ed25519');const sessionId=randomUUID(),assetId=randomUUID(),now=1791374400000;
const input={sessionId,assetId,generation:1,scope:'playback' as const,method:'GET' as const,namespace:`asset/${assetId}/1/`,expectedBytes:100,ttlSeconds:300};
const request:CapabilityRequest={...input,resourcePath:input.namespace+'master.m3u8'};
const issuer=new Ed25519MediaCapabilityIssuer(pair.privateKey,'local',()=>now);const keys={local:pair.publicKey};
function edited(token:string,section:0|1,patch:Record<string,unknown>){const p=token.split('.');p[section]=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(p[section]!,'base64url').toString()),...patch})).toString('base64url');p[2]=sign(null,Buffer.from(`${p[0]}.${p[1]}`),pair.privateKey).toString('base64url');return p.join('.');}
test('5.1 real EdDSA GET/HEAD capability verifies before current DB authorization, key rotation',async()=>{
 const grant=issuer.issue(input);let calls=0;const allow=async()=>{calls++;return true;};
 assert.equal((await verifyMediaCapability(grant.token,request,keys,allow,()=>now)).assetId,assetId);
 await verifyMediaCapability(grant.token,{...request,method:'HEAD'},keys,allow,()=>now);assert.equal(calls,2);assert.equal(grant.expiresAt,now+300000);
 await assert.rejects(verifyMediaCapability(grant.token,{...request,method:'PUT'},keys,allow,()=>now));
 await assert.rejects(verifyMediaCapability(grant.token,request,keys,async()=>false,()=>now));
});
test('5.1 rejects wrong audience/kid/alg/tampering/expiry/oversize/path/generation',async()=>{
 const {token}=issuer.issue(input);let calls=0;const allow=async()=>{calls++;return true;};
 for(const invalid of [edited(token,1,{aud:'wrong'}),edited(token,0,{kid:'unknown'}),edited(token,0,{alg:'none'}),token.slice(0,-4)+'AAAA','a'.repeat(4097),edited(token,1,{namespace:'asset/other/1/'})])await assert.rejects(verifyMediaCapability(invalid,request,keys,allow,()=>now));
 assert.equal(calls,0);
 await assert.rejects(verifyMediaCapability(token,request,keys,allow,()=>now+331000));
 for(const path of [input.namespace+'../private',input.namespace+'%2e%2e/private','https://evil/x',input.namespace+'a//b'])await assert.rejects(verifyMediaCapability(token,{...request,resourcePath:path},keys,allow,()=>now));
 await assert.rejects(verifyMediaCapability(token,{...request,generation:2},keys,allow,()=>now));assert.equal(calls,0);
 assert.throws(()=>issuer.issue({...input,ttlSeconds:301}));
});
test('5.1 upload bearer capability is limited to transfer namespace, bytes and 15 minutes',async()=>{
 const upload={...input,scope:'upload' as const,method:'PUT' as const,namespace:`transfer/${sessionId}/1/`,ttlSeconds:900};const {token}=issuer.issue(upload);
 await verifyMediaCapability(token,{...request,...upload,resourcePath:upload.namespace+'0-99'},keys,async()=>true,()=>now);
 await assert.rejects(verifyMediaCapability(token,{...request,...upload,expectedBytes:101,resourcePath:upload.namespace+'0-99'},keys,async()=>true,()=>now));
});
