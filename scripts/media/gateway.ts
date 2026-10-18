import { readFile } from 'node:fs/promises';
import { createMediaGateway,assertLocalGateway } from '../../lib/media/gateway/server';
import { MediaRepository } from '../../lib/media/repository';
import { createGatewayDelivery } from '../../lib/media/gateway/delivery';
import { getMockStorage } from '../../lib/media/runtime';
import { verifyMockFixture } from '../../lib/media/mock-processing';
import path from 'node:path';
async function main(){
  assertLocalGateway(process.env);
  await verifyMockFixture(path.resolve('tests/media/fixtures/hls'));
  const key=process.env.MEDIA_CAPABILITY_PUBLIC_KEY??await readFile(process.env.MEDIA_CAPABILITY_PUBLIC_KEY_FILE??'work/media-local/keys/public.pem','utf8');
  const kid=process.env.MEDIA_CAPABILITY_KEY_ID;if(!kid)throw new Error('MEDIA_GATEWAY_KEY_REQUIRED');
  const deps={repository:new MediaRepository(),storage:getMockStorage(),publicKeys:{[kid]:key},origins:['http://127.0.0.1:4318','http://localhost:4318']};
  const server=createMediaGateway(deps,createGatewayDelivery(deps,path.resolve('tests/media/fixtures/hls')));
  server.requestTimeout=60_000;server.headersTimeout=15_000;server.maxHeadersCount=40;
  server.listen(4319,'127.0.0.1',()=>console.log('MEDIA_GATEWAY_READY'));
  for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>process.exit(0)));
}
void main().catch(()=>{console.error('MEDIA_GATEWAY_START_FAILED');process.exitCode=1;});
