import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { safeLegacyReference } from '../../scripts/media/legacy-inventory';
import { migrationDryRun } from '../../scripts/media/legacy-migrate';
import { localLoadOptions, loadPlaylist } from '../../scripts/media/load-hls';

test('8.6 inventory removes credentials and query tokens, and dry-run has no apply action',()=>{
  const reference=safeLegacyReference('https://video.example.invalid/movie.mp4?cap=secret#token');
  assert.equal(reference?.origin,'https://video.example.invalid');assert.equal(reference?.path,'/movie.mp4');
  assert.ok(!JSON.stringify(reference).includes('secret'));assert.equal(safeLegacyReference('file:///tmp/private')?.eligible,false);
  const dry=migrationDryRun({version:1,environment:'local',readOnly:true,titles:[{id:1,slug:'legacy',ownerId:'owner',status:'published',playbackKind:'legacy',mainMediaId:null,references:{r2_video_url:reference}}],mediaStates:[],orphanMedia:[],orphanTransferDirectories:[],orphanAssetDirectories:[]});
  assert.equal(dry.writes,0);assert.equal(dry.networkRequests,0);assert.deepEqual(dry.items[0]?.blockers,['VPS_REQUIRED','REMOTE_SOURCE_SHA_DURATION_AND_OWNERSHIP_UNVERIFIED']);
});
test('8.6 load harness validates bounds, parses EXTINF/MAP, rejects remote/private URL traversal',()=>{
  assert.equal(localLoadOptions(['--viewers','10','--duration','6','--scenario','local-fixture']).viewers,10);
  assert.throws(()=>localLoadOptions(['--viewers','201','--duration','6','--scenario','local-fixture']));
  const base='http://127.0.0.1:4319/playback/asset/1/v0/index.m3u8?cap=x';
  const resources=loadPlaylist('#EXTM3U\n#EXT-X-MAP:URI="init.mp4?cap=x"\n#EXTINF:4.0,\nsegment.m4s?cap=x',base);
  assert.deepEqual(resources.map(r=>r.seconds),[0,4]);
  assert.throws(()=>loadPlaylist('#EXTM3U\nhttps://remote.invalid/file',base));
  assert.throws(()=>loadPlaylist('#EXTM3U\n../../../../fixtures/legacy.mp4',base));
});
test('8.6 cached official v8.3.1 schema validates the merged private/no-P2P policy offline',()=>{
  const require=createRequire(import.meta.url);
  const result:unknown=require('../../scripts/media/validate-peertube.cjs').validate();
  assert.deepEqual(result,{version:'v8.3.1',schemaValidated:true,p2p:false,deployable:false,placeholdersRequireVps:true});
});
