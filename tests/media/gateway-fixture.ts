import { generateKeyPairSync } from 'node:crypto';
import type { Server } from 'node:http';
import { Ed25519MediaCapabilityIssuer } from '../../lib/media/capabilities';
import { createMediaGateway,type GatewayDelivery } from '../../lib/media/gateway/server';
import { serviceHarness } from './service-harness';
import type { GatewayDependencies } from '../../lib/media/gateway/transfer';
export async function gatewayHarness(bytes?:Buffer,override:Partial<GatewayDependencies>={},deliveryFactory?:(deps:GatewayDependencies)=>GatewayDelivery){
 const h=await serviceHarness(bytes?Buffer.from(bytes):undefined);const keys=generateKeyPairSync('ed25519');const issuer=new Ed25519MediaCapabilityIssuer(keys.privateKey,'test');
 const context=await h.service.context(h.id);const grant=issuer.issue({sessionId:h.id,assetId:context.asset.id,generation:1,scope:'upload',method:'PUT',namespace:`transfer/${h.id}/1/`,expectedBytes:h.bytes.length,ttlSeconds:900});
 const deps:GatewayDependencies={repository:h.repo,storage:h.storage,publicKeys:{test:keys.publicKey},origins:['http://127.0.0.1:4318'],...override};
 let server:Server;let origin='';
 const start=async()=>{server=createMediaGateway(deps,deliveryFactory?.(deps));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No address');origin=`http://127.0.0.1:${address.port}`;};
 const stop=async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));};
 await start();
 return {...h,deps,issuer,get origin(){return origin;},get url(){return `${origin}/transfer/${h.id}`;},headers:{Authorization:`Bearer ${grant.token}`},async restart(){await stop();await start();},async close(){await stop();await h.close();}};
}
