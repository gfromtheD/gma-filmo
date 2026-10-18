import assert from 'node:assert/strict';
import test from 'node:test';
import { managedClientState } from '@/lib/uploads/client-models';
import type { MediaAssetDTO, UploadSessionDTO } from '@/types/media-engine';

const session = (state: UploadSessionDTO['state']): UploadSessionDTO => ({ sessionId:'11111111-1111-4111-8111-111111111111',
  mediaId:'22222222-2222-4222-8222-222222222222',draftId:'33333333-3333-4333-8333-333333333333',role:'main',slot:'main',language:null,
  state,revision:1,transferGeneration:1,expectedBytes:10,sourceSha256:'a'.repeat(64),expiresAt:'2026-10-09T00:00:00.000Z',
  receivedBytes:5,transferProgress:50,fileName:'fixture.mp4',contentType:'video/mp4' });
const asset = (status: MediaAssetDTO['status']): MediaAssetDTO => ({ mediaId:'22222222-2222-4222-8222-222222222222',status,
  role:'main',durationSeconds:null,receivedBytes:5,revision:1,processingGeneration:1,processingProgress:35,deliveryUrl:null,
  error:null,metadata:{},createdAt:'2026-10-09T00:00:00.000Z',updatedAt:'2026-10-09T00:00:00.000Z' });

test('neutral queue maps durable processing, failure, cancellation and READY states', () => {
  assert.equal(managedClientState(session('uploaded'),asset('processing')),'processing');
  assert.equal(managedClientState(session('failed'),asset('failed')),'error');
  assert.equal(managedClientState(session('cancelling'),asset('deleting')),'cancelling');
  assert.equal(managedClientState(session('uploading'),asset('ready')),'done');
  assert.equal(managedClientState(session('paused'),asset('received')),'paused');
  assert.equal(managedClientState(session('uploading'),asset('received')),'uploading');
});

test('durable transfer restored without a local file requires reselection, while processing needs no file',()=>{
  assert.equal(managedClientState(session('uploading'),asset('received'),false),'paused');
  assert.equal(managedClientState(session('uploading'),asset('received'),true),'uploading');
  assert.equal(managedClientState(session('uploaded'),asset('processing'),false),'processing');
});
