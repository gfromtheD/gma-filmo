import path from 'node:path';
import type { MediaProviderKey, ProviderSnapshot } from '@/types/media-engine';
import type { ProviderAssetContext } from './provider';
import { MockMediaProcessing, type MockProcessingClock, type MockProcessingScenario } from './mock-processing';
import { MockMediaStorage } from './mock-storage';
import { getMockStorage } from './runtime';

export interface MediaJobProcessor { process(context: ProviderAssetContext): Promise<ProviderSnapshot> }
export interface MediaJobProcessors { get(key: MediaProviderKey): MediaJobProcessor | null }
const scenarios = new Set<MockProcessingScenario>(['success','processing-fails-once','reject-invalid','delete-pending-once','cancel-during-processing']);
export function mockJobProcessor(storage: MockMediaStorage, clock?: MockProcessingClock): MediaJobProcessor {
  const engine=new MockMediaProcessing(storage,path.resolve('tests/media/fixtures/hls'),clock);
  return {async process(context) {
    const raw=context.privateState.mockScenario;
    const scenario=typeof raw==='string' && scenarios.has(raw as MockProcessingScenario)?raw as MockProcessingScenario:'success';
    const result=await engine.run(context,scenario);
    return {status:result.status==='cancelled'?'rejected':result.status,durationSeconds:result.durationSeconds,metadata:result.metadata,
      receivedBytes:context.session.expected_input_bytes,playbackVerified:result.status==='ready',error:result.error};
  }};
}
export function createMediaJobProcessors(): MediaJobProcessors {
  return {get(key) {return key==='mock'?mockJobProcessor(getMockStorage()):null;}};
}
export function mediaJobBackoff(attempts: number): number {return Math.min(60_000,1_000*2**Math.min(attempts,6));}
