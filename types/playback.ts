export interface SubtitleSource {
  id: string;
  language: string;
  label: string;
  url: string;
  default: boolean;
  format: 'vtt';
}

export interface PlaybackThumbnailSource {
  vttUrl: string;
  imageUrl: string;
  tileWidth: number;
  tileHeight: number;
}

export interface PlaybackIdentity {
  version: 1;
  mediaId: string | null;
  titleSlug: string | null;
  titleId: number | null;
  revision: number;
  expiresAt: number | null;
  refreshUrl: string;
  subtitles: SubtitleSource[];
  posterUrl: string | null;
  thumbnails: PlaybackThumbnailSource | null;
}

export interface LegacyMp4Fallback {
  kind: 'mp4';
  url: string;
}

export interface HlsPlaybackSource extends PlaybackIdentity {
  kind: 'hls';
  url: string;
  mimeType: 'application/vnd.apple.mpegurl';
  p2p: 'none';
  fallback: LegacyMp4Fallback | null;
}

export interface Mp4PlaybackSource extends PlaybackIdentity {
  kind: 'mp4';
  url: string;
  mimeType: 'video/mp4';
}

export interface YouTubePlaybackSource extends PlaybackIdentity {
  kind: 'youtube';
  videoId: string;
}

export type PlaybackSource = HlsPlaybackSource | Mp4PlaybackSource | YouTubePlaybackSource;

export interface PlaybackReference {
  titleSlug: string;
  mode: 'managed' | 'legacy';
}
