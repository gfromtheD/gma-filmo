export type PeerTubeState = 'published' | 'processing' | 'failed' | 'rejected' | 'unknown';
export interface PeerTubeStateMapping { status: PeerTubeState; retryable: boolean; code: string | null; }

/** PeerTube v8.3.1 source mapping; unknown values must never be treated as READY. */
export function mapPeerTubeState(stateId: number): PeerTubeStateMapping {
  switch (stateId) {
    case 1: return { status: 'published', retryable: false, code: null };
    case 2: case 3: case 6: case 9: case 10: return { status: 'processing', retryable: true, code: null };
    case 4: case 5: return { status: 'rejected', retryable: false, code: 'PROVIDER_VOD_STATE_INVALID' };
    case 7: case 8: case 11: case 12: return { status: 'failed', retryable: false, code: 'PEERTUBE_TRANSCODING_FAILED' };
    default: return { status: 'unknown', retryable: false, code: 'PROVIDER_STATE_UNSUPPORTED' };
  }
}
