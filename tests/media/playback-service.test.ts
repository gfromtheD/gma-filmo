import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID,generateKeyPairSync} from 'node:crypto';
import {serviceHarness} from './service-harness';import {OWNER,OTHER} from './database';
import {PlaybackService} from '../../lib/media/playback-service';import {TitleService} from '../../lib/media/title-service';
import {legacyMediaUrl,legacyYouTubeId,resolveLegacyPlayback} from '../../lib/media/legacy-playback';
import {Ed25519MediaCapabilityIssuer,verifyMediaCapability} from '../../lib/media/capabilities';
import {MockMediaProvider} from '../../lib/media/providers/mock';import {MediaProviderRegistry} from '../../lib/media/registry';
test('4.8 legacy HTTPS exact hosts, MP4 precedence, YouTube and no-source422; local fixture fenced',()=>{
 const env={NEXT_PUBLIC_R2_PUBLIC_URL:'https://legacy.example'};const row={id:1,slug:'old-film',r2_video_url:'https://legacy.example/film.mp4',youtube_url:'https://youtu.be/abcdefghijk'};
 assert.equal(resolveLegacyPlayback(row,env).kind,'mp4');assert.equal(resolveLegacyPlayback({...row,r2_video_url:null},env).kind,'youtube');
 for(const url of ['https://legacy.example.evil/x','http://legacy.example/x','https://user@legacy.example/x','https://legacy.example:444/x','javascript:x'])assert.equal(legacyMediaUrl(url,env),null);
 assert.equal(legacyYouTubeId('https://evil.example/watch?v=abcdefghijk'),null);assert.throws(()=>resolveLegacyPlayback({...row,r2_video_url:null,youtube_url:null},env),e=>e instanceof Error && 'status' in e && e.status===422);
 const local={UPLOAD_ENVIRONMENT:'local',MEDIA_MOCK_ENABLED:'true',SUPABASE_URL:'http://127.0.0.1:54341'};
 assert.ok(legacyMediaUrl('http://127.0.0.1:4319/fixtures/legacy.mp4',local));assert.equal(legacyMediaUrl('http://127.0.0.1:4319/transfer/file.mp4',local),null);
 const fixture=resolveLegacyPlayback({...row,r2_video_url:'http://127.0.0.1:4319/fixtures/legacy.mp4',r2_subtitle_url:'http://127.0.0.1:4319/fixtures/legacy.es.vtt',r2_poster_url:'http://127.0.0.1:4319/fixtures/legacy.poster.webp'},local);
 assert.equal(fixture.subtitles[0]?.url,'/api/subtitle-proxy?url=http%3A%2F%2F127.0.0.1%3A4319%2Ffixtures%2Flegacy.es.vtt');assert.equal(fixture.posterUrl,'http://127.0.0.1:4319/fixtures/legacy.poster.webp');
 for(const filename of ['legacy.es.vtt','legacy.en.vtt','legacy.poster.webp']) {
  assert.ok(legacyMediaUrl(`http://127.0.0.1:4319/fixtures/${filename}`,local));
  assert.equal(legacyMediaUrl(`http://127.0.0.1:4319/fixtures/${filename}`,env),null);
 }
 assert.equal(legacyMediaUrl('http://127.0.0.1:4319/fixtures/unlisted.vtt',local),null);
});
test('4.8 signed HLS draft preview is owner only; publication resolves junction; withdrawal revokes playback',async()=>{
 const h=await serviceHarness();try {
 await h.ingest();await h.service.complete(OWNER,h.id,1);await h.service.tick(1);await h.service.tick(1,true);
 const pair=generateKeyPairSync('ed25519');const issuer=new Ed25519MediaCapabilityIssuer(pair.privateKey,'test');const provider=new MockMediaProvider(h.storage,h.repo,'http://127.0.0.1:4319',issuer);
 const registry=new MediaProviderRegistry({mock:()=>provider,r2:()=>{throw Error('R2 not expected');},stream:()=>{throw Error('Stream not expected');},peertube:()=>{throw Error('PeerTube not expected');}},()=> 'mock');
 const playback=new PlaybackService(h.repo,registry);const state=await h.service.envelope(OWNER,h.id);const preview=await playback.resolvePreview(state.asset.mediaId,OWNER);assert.equal(preview.titleId,null);assert.equal(preview.titleSlug,null);assert.equal(preview.kind,'hls');
 if(preview.kind!=='hls')throw Error('expected HLS');assert.equal(preview.p2p,'none');assert.ok(preview.expiresAt);
 const token=new URL(preview.url).searchParams.get('cap')!;assert.ok(token);
 const request={sessionId:h.id,assetId:state.asset.mediaId,generation:1,scope:'playback' as const,method:'GET' as const,resourcePath:`asset/${state.asset.mediaId}/1/master.m3u8`,expectedBytes:h.bytes.length};
 await verifyMediaCapability(token,request,{test:pair.publicKey},async()=>{await h.repo.authorizePlayback(state.asset.mediaId,OWNER);return true;});
 await assert.rejects(playback.resolvePreview(state.asset.mediaId,OTHER));
 await h.repo.uploadCommand(OWNER,'update_draft',{draft_id:h.input.draft_id,revision:state.draftRevision,metadata:{title:'Playback film'}});const draft=await h.repo.draft(OWNER,h.input.draft_id);const titles=new TitleService(h.repo);const published=await titles.publish(OWNER,{draft_id:draft.id,revision:draft.revision,main_media_id:state.asset.mediaId});
 const source=await playback.resolveTitle(published.title.slug,null);assert.equal(source.mediaId,state.asset.mediaId);assert.equal(source.kind,'hls');assert.equal(source.titleId,published.title.id);
 assert.equal(source.kind==='hls'?source.fallback:null,null);
 await h.db.query(`INSERT INTO gma_title_media_versions(title_id,revision,owner_id,snapshot,retained_until)
   VALUES($1,0,$2,jsonb_build_object('playback_kind','legacy','r2_video_url','https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/old.mp4'),now()+interval '7 days')`,[published.title.id,OWNER]);
 const fallbackSource=await playback.resolveTitle(published.title.slug,null);assert.equal(fallbackSource.kind,'hls');
 if(fallbackSource.kind!=='hls')throw Error('expected HLS');assert.deepEqual(fallbackSource.fallback,{kind:'mp4',url:`/api/titles/${published.title.slug}/legacy-fallback`});
 assert.equal(await playback.resolveLegacyFallback(published.title.slug,null),'https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev/old.mp4');
 await assert.rejects(playback.resolvePreview(state.asset.mediaId,OWNER));
 await titles.lifecycle(OWNER,published.title.slug,'unpublish',{revision:published.title.mediaRevision,idempotency_key:randomUUID()});
 await assert.rejects(playback.resolveLegacyFallback(published.title.slug,null));
 await assert.rejects(playback.resolveTitle(published.title.slug,null));await assert.rejects(playback.resolveTitle(published.title.slug,OTHER));assert.equal((await playback.resolveTitle(published.title.slug,OWNER)).mediaId,state.asset.mediaId);
 await assert.rejects(verifyMediaCapability(token,request,{test:pair.publicKey},async()=>{await h.repo.authorizePlayback(state.asset.mediaId,null,published.title.slug);return true;}));
 }finally{await h.close();}
});
