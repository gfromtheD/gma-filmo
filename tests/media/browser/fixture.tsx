'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlayerScreen } from '@/components/features/player/player-screen';
import type { MovieMedia } from '@/types/catalog';
import { useMediaPlayback } from '@/hooks/use-media-playback';

function EngineFixture() {
  const params = useSearchParams();
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const playback = useMediaPlayback(video, '/api/media/player-test-fixture/source?kind=' + (params.get('kind') ?? 'hls'), true, null,
    { playing: false, muted: true, volume: 0.7, rate: 1 });
  return <main><video ref={setVideo} controls playsInline muted style={{ width: '100%' }} />
    <button onClick={playback.refresh}>Renew</button><span role="alert">{playback.error}</span></main>;
}

function EngineFixtureHost() {
  const [mounted, setMounted] = useState(true);
  return <main>{mounted && <EngineFixture />}<button onClick={() => setMounted(false)}>Unmount engine</button></main>;
}

const item: MovieMedia = { id: 'media-player-fixture', numericId: 1, kind: 'movie', title: 'Player local', runtime: '12 s', year: 2026,
  rating: 'TP', categories: [], synopsis: 'Fixture local', playbackRef: { titleSlug: 'media-player-fixture', mode: 'managed' },
  style: { tone: ['#111', '#222'], accent: '#22B16B', motif: 'ring' } };
export default function PlayerFixture() {
  const params = useSearchParams();
  return params.get('engine') ? <EngineFixtureHost /> : <PlayerScreen item={item} initialTime={params.has('initial') ? Number(params.get('initial')) : undefined} />;
}
