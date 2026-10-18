import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMainMediaPublishPayload, managedDraftDetailSchema } from '@/lib/uploads/managed-browser';

const mainId='22222222-2222-4222-8222-222222222222',sessionId='11111111-1111-4111-8111-111111111111',draftId='33333333-3333-4333-8333-333333333333';
function detail(extraStatus:'ready'|'processing'='ready') { return managedDraftDetailSchema.parse({version:1,draft:{id:draftId,purpose:'title',state:'draft',revision:7,
  titleId:null,metadata:{title:'Film',synopsis:'Synopsis'},createdAt:'2026-10-09T00:00:00.000Z',updatedAt:'2026-10-09T00:00:00.000Z'},uploads:[
  {version:1,session:{sessionId,mediaId:mainId,draftId,role:'main',slot:'main',language:null,state:'uploaded',revision:2,transferGeneration:1,
    expectedBytes:10,sourceSha256:'a'.repeat(64),expiresAt:'2026-10-09T00:00:00.000Z',receivedBytes:10,transferProgress:100,fileName:'main.mp4',contentType:'video/mp4'},
   asset:{mediaId:mainId,status:'ready',role:'main',durationSeconds:90,receivedBytes:10,revision:3,processingGeneration:1,processingProgress:100,
    deliveryUrl:null,error:null,metadata:{},createdAt:'2026-10-09T00:00:00.000Z',updatedAt:'2026-10-09T00:00:00.000Z'},draftRevision:7},
  {version:1,session:{sessionId:'44444444-4444-4444-8444-444444444444',mediaId:'55555555-5555-4555-8555-555555555555',draftId,
    role:'subtitles',slot:'subtitles:en',language:'en',state:'uploaded',revision:2,transferGeneration:1,expectedBytes:10,sourceSha256:'b'.repeat(64),
    expiresAt:'2026-10-09T00:00:00.000Z',receivedBytes:10,transferProgress:100,fileName:'en.vtt',contentType:'text/vtt'},
   asset:{mediaId:'55555555-5555-4555-8555-555555555555',status:extraStatus,role:'subtitles',durationSeconds:null,receivedBytes:10,revision:3,
    processingGeneration:1,processingProgress:extraStatus==='ready'?100:55,deliveryUrl:null,error:null,metadata:{},createdAt:'2026-10-09T00:00:00.000Z',
    updatedAt:'2026-10-09T00:00:00.000Z'},draftRevision:7} ]}); }

test('Studio publishes only draft revision and READY main media UUID',()=>{
  assert.deepEqual(buildMainMediaPublishPayload(detail(),mainId),{draft_id:draftId,revision:7,main_media_id:mainId});
  assert.throws(()=>buildMainMediaPublishPayload(detail(),sessionId),/MAIN_NOT_READY/);
});

test('Studio blocks publish while any subtitle or auxiliary is still processing',()=>{
  assert.throws(()=>buildMainMediaPublishPayload(detail('processing'),mainId),/ATTACHMENTS_NOT_READY/);
});
