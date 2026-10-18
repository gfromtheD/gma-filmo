import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { JsonObject } from '@/types/media-engine';
import type { ProviderAssetContext } from './provider';
import { MediaError } from './errors';
import { MockMediaStorage, type MockFixtureFile } from './mock-storage';

export type MockProcessingScenario = 'success' | 'processing-fails-once' | 'reject-invalid' | 'delete-pending-once' | 'cancel-during-processing';
export interface MockProcessingClock { now(): number; wait(milliseconds: number): Promise<void> }
export interface MockProcessingResult {
  status: 'ready' | 'failed' | 'rejected' | 'cancelled';
  durationSeconds: number | null;
  metadata: JsonObject;
  error: { code: string; retryable: boolean } | null;
  finishedAt: string;
}
export interface MockFixtureManifest { files: MockFixtureFile[]; bytes: number; manifestHash: string }

const defaultClock: MockProcessingClock = { now: () => Date.now(), wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

export async function verifyMockFixture(fixtureRoot: string): Promise<MockFixtureManifest> {
  if (!path.isAbsolute(fixtureRoot)) throw new MediaError('UPLOAD_INVALID_INPUT');
  const base = path.resolve(fixtureRoot);
  const sums = await readFile(path.join(base, 'SHA256SUMS'), 'utf8');
  const files: MockFixtureFile[] = [];
  for (const line of sums.trim().split('\n')) {
    const match = /^([a-f0-9]{64})  ([a-zA-Z0-9_./-]+)$/.exec(line);
    if (!match) throw new MediaError('UPLOAD_INVALID_INPUT');
    const relative = match[2]!;
    if (relative.startsWith('/') || relative.split('/').some((part) => part === '' || part === '.' || part === '..')) throw new MediaError('UPLOAD_INVALID_INPUT');
    const fullPath = path.resolve(base, relative);
    if (!fullPath.startsWith(`${base}${path.sep}`)) throw new MediaError('UPLOAD_INVALID_INPUT');
    const body = await readFile(fullPath);
    const digest = createHash('sha256').update(body).digest('hex');
    if (digest !== match[1]) throw new MediaError('UPLOAD_SOURCE_MISMATCH');
    files.push({ relative, sha256: digest, size: body.byteLength });
  }
  const names = new Set(files.map((file) => file.relative));
  for (const required of ['legacy.mp4','master.m3u8','v0/index.m3u8','v1/index.m3u8','v0/init_0.mp4','v1/init_1.mp4','subtitles.es.vtt','subtitles.en.vtt','poster.webp']) {
    if (!names.has(required)) throw new MediaError('UPLOAD_INVALID_INPUT');
  }
  for (const playlist of ['master.m3u8','v0/index.m3u8','v1/index.m3u8']) {
    const content = await readFile(path.join(base, playlist), 'utf8');
    if (!content.startsWith('#EXTM3U\n')) throw new MediaError('UPLOAD_INVALID_INPUT');
    const references = content.split(/\r?\n/).flatMap((line) => {
      if (!line || line.startsWith('#')) {
        const uri = line.match(/URI="([^"]+)"/)?.[1];
        return uri ? [path.posix.join(path.posix.dirname(playlist), uri)] : [];
      }
      return [path.posix.join(path.posix.dirname(playlist), line)];
    });
    if (references.some((relative) => !names.has(relative))) throw new MediaError('UPLOAD_INVALID_INPUT');
  }
  const byteLength = files.reduce((total, file) => total + file.size, 0);
  if (byteLength > 10 * 1024 * 1024) throw new MediaError('UPLOAD_INVALID_INPUT');
  return { files, bytes: byteLength, manifestHash: createHash('sha256').update(sums).digest('hex') };
}

/** Deterministic provider simulation. SQL job/CAS mutations remain the caller's responsibility. */
export class MockMediaProcessing {
  constructor(private readonly storage: MockMediaStorage, private readonly fixtureRoot: string,
    private readonly clock: MockProcessingClock = defaultClock) {}

  async run(context: ProviderAssetContext, scenario: MockProcessingScenario, options: { cancelled?: boolean } = {}): Promise<MockProcessingResult> {
    if (scenario === 'reject-invalid') return this.result('rejected', null, {}, { code: 'MOCK_INPUT_INVALID', retryable: false });
    const delay = scenario === 'processing-fails-once' ? 2_000 : 3_000;
    await this.clock.wait(delay);
    if (context.signal.aborted || (scenario === 'cancel-during-processing' && options.cancelled)) return this.result('cancelled', null, {}, { code: 'UPLOAD_CANCELLED', retryable: false });
    if (scenario === 'processing-fails-once' && context.processingGeneration === 1) {
      return this.result('failed', null, {}, { code: 'MOCK_PROCESSING_TRANSIENT', retryable: true });
    }
    const fixture = await verifyMockFixture(this.fixtureRoot);
    await this.storage.installFixture(context.asset.id, context.processingGeneration, this.fixtureRoot, fixture.files);
    const outputInventory = fixture.files.filter((file) => file.relative.endsWith('.m3u8') || file.relative.endsWith('.m4s') || file.relative.endsWith('.mp4') || file.relative.endsWith('.webp') || file.relative.endsWith('.vtt'))
      .map((file) => ({ relative: file.relative, bytes: file.size, mime: contentType(file.relative), sha256: file.sha256 }));
    const metadata: JsonObject = {
      source_sha256: context.session.source_sha256, outputs_verified: true, processed_bytes: outputInventory.reduce((total, output) => total + output.bytes, 0),
      hls_prefix: `mock/${context.asset.id}/${context.processingGeneration}/`, synthetic_playback: true, verified_by: 'mock-fixture-v1', hls_master: 'master.m3u8', auxiliary_file: 'poster.webp',
      width: 1280, height: 720, duration_seconds: 12, outputs: outputInventory,
      fixture_manifest_sha256: fixture.manifestHash,
    };
    return this.result('ready', 12, metadata, null);
  }

  private result(status: MockProcessingResult['status'], durationSeconds: number | null, metadata: JsonObject,
    error: MockProcessingResult['error']): MockProcessingResult {
    return { status, durationSeconds, metadata, error, finishedAt: new Date(this.clock.now()).toISOString() };
  }
}

function contentType(relative: string): string {
  if (relative.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (relative.endsWith('.m4s')) return 'video/iso.segment';
  if (relative.endsWith('.mp4')) return 'video/mp4';
  if (relative.endsWith('.webp')) return 'image/webp';
  if (relative.endsWith('.vtt')) return 'text/vtt';
  return 'application/octet-stream';
}
