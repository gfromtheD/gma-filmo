import { z } from 'zod';
import type {
  AssetRole,
  MediaAssetDTO,
  MediaProof,
  TransferDescriptor,
  TransferState,
  UploadSessionDTO,
} from '@/types/media-engine';
import type { PlaybackSource } from '@/types/playback';

const localHttpHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

export const mediaUrlSchema = z.string().min(1).max(2048).refine((value) => {
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return false;

  if (value.startsWith('/')) {
    if (!value.startsWith('/api/') || value.startsWith('//')) return false;
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      return false;
    }
    return !decoded.split('/').some((part) => part === '.' || part === '..');
  }

  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && localHttpHosts.has(url.hostname);
  } catch {
    return false;
  }
}, 'URL de reproducción no permitida');

const titleSlugSchema = z.string().min(1).max(180).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const thumbnailSchema = z.object({
  vttUrl: mediaUrlSchema,
  imageUrl: mediaUrlSchema,
  tileWidth: z.number().int().positive().max(8192),
  tileHeight: z.number().int().positive().max(8192),
}).strict();

const identityShape = {
  version: z.literal(1),
  mediaId: z.string().uuid().nullable(),
  titleSlug: titleSlugSchema.nullable(),
  titleId: z.number().int().positive().nullable(),
  revision: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive().nullable(),
  refreshUrl: mediaUrlSchema.refine((value) => value.startsWith('/api/'), 'refreshUrl debe ser un endpoint GMA'),
  subtitles: z.array(z.object({
    id: z.string().min(1).max(200),
    language: z.string().min(2).max(35),
    label: z.string().min(1).max(100),
    url: mediaUrlSchema,
    default: z.boolean(),
    format: z.literal('vtt'),
  }).strict()).max(32),
  posterUrl: mediaUrlSchema.nullable(),
  thumbnails: thumbnailSchema.nullable(),
};

const commonPlaybackSchema = z.object(identityShape).strict().refine(
  ({ titleSlug, titleId }) => (titleSlug === null) === (titleId === null),
  'titleSlug y titleId deben ser ambos nulos o estar ambos presentes',
);

const fallbackSchema = z.object({ kind: z.literal('mp4'), url: mediaUrlSchema }).strict();

export const playbackSourceSchema: z.ZodType<PlaybackSource> = z.discriminatedUnion('kind', [
  commonPlaybackSchema.extend({
    kind: z.literal('hls'),
    url: mediaUrlSchema,
    mimeType: z.literal('application/vnd.apple.mpegurl'),
    p2p: z.literal('none'),
    fallback: fallbackSchema.nullable(),
  }).strict(),
  commonPlaybackSchema.extend({
    kind: z.literal('mp4'),
    url: mediaUrlSchema,
    mimeType: z.literal('video/mp4'),
  }).strict(),
  commonPlaybackSchema.extend({
    kind: z.literal('youtube'),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  }).strict(),
]);

export type ParsedPlaybackSource = PlaybackSource;

const safeBytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positiveSafeBytes = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const sha256Proof = z.object({
  kind: z.literal('mock-sha256'),
  size: positiveSafeBytes,
  sha256: digest,
  transferGeneration: z.number().int().positive(),
  chunkManifestHash: digest,
}).strict();
const r2ReceiptProof = z.object({
  kind: z.literal('r2-receipt'),
  size: positiveSafeBytes,
  etag: z.string().min(1).max(512),
  objectKey: z.string().min(1).max(1024).refine((value) => !value.startsWith('/') && !value.includes('..') && !/[\\\u0000-\u001f\u007f]/.test(value)),
  completedPartsHash: digest,
}).strict();
const peerTubeProof = z.object({
  kind: z.literal('peertube-gateway'),
  uploadId: z.string().min(1).max(2048),
  videoUUID: z.string().uuid(),
  totalBytes: positiveSafeBytes,
  upstreamReceivedBytes: positiveSafeBytes,
  gmaSha256: digest,
  correlationName: z.string().min(1).max(120),
  finalizingAt: z.string().datetime({ offset: true }),
}).strict().refine((proof) => proof.totalBytes === proof.upstreamReceivedBytes, 'El total recibido debe coincidir con la subida');
const streamReceiptProof = z.object({
  kind: z.literal('stream-receipt'),
  uid: z.string().min(1).max(128),
  receivedBytes: positiveSafeBytes,
  inspectedAt: z.string().datetime({ offset: true }),
}).strict();

export const mediaProofSchema: z.ZodType<MediaProof> = z.discriminatedUnion('kind', [
  sha256Proof,
  r2ReceiptProof,
  peerTubeProof,
  streamReceiptProof,
]);

const headerName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const transferHeadersSchema = z.record(
  z.string().regex(headerName),
  z.string().max(8192).refine((value) => !/[\r\n\u0000]/.test(value)),
).refine((headers) => Object.keys(headers).length <= 16);

export const transferDescriptorSchema: z.ZodType<TransferDescriptor> = z.discriminatedUnion('protocol', [
  z.object({
    protocol: z.literal('put'),
    url: mediaUrlSchema,
    headers: transferHeadersSchema,
    expiresAt: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    protocol: z.literal('multipart'),
    inspectUrl: mediaUrlSchema,
    partUrl: mediaUrlSchema,
    partSize: positiveSafeBytes,
    generation: z.number().int().positive(),
    concurrency: z.literal(2),
  }).strict(),
  z.object({
    protocol: z.literal('tus'),
    url: mediaUrlSchema,
    chunkSize: positiveSafeBytes,
    expiresAt: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    protocol: z.literal('uploadx'),
    url: mediaUrlSchema,
    headers: transferHeadersSchema,
    chunkSize: positiveSafeBytes.max(16 * 1024 * 1024),
    offset: safeBytes,
    totalBytes: positiveSafeBytes,
    expiresAt: z.string().datetime({ offset: true }),
  }).strict().refine((transfer) => transfer.offset <= transfer.totalBytes),
]);

export const mediaAssetDTOSchema: z.ZodType<MediaAssetDTO> = z.object({
  mediaId: z.string().uuid(),
  status: z.enum(['received', 'validating', 'processing', 'ready', 'failed', 'rejected', 'deleting', 'deleted']),
  role: z.enum(['main', 'trailer', 'extras', 'extra_image', 'intro', 'poster', 'poster_h', 'poster_v', 'subtitles', 'avatar']),
  durationSeconds: z.number().nonnegative().nullable(),
  receivedBytes: safeBytes.nullable(),
  revision,
  processingGeneration: z.number().int().positive(),
  processingProgress: z.number().min(0).max(100).nullable(),
  deliveryUrl: mediaUrlSchema.nullable(),
  error: z.object({ code: z.string().min(1).max(100), retryable: z.boolean() }).strict().nullable(),
  metadata: z.object({
    width: z.number().int().positive().max(8192).optional(),
    height: z.number().int().positive().max(8192).optional(),
    syntheticPlayback: z.boolean().optional(),
  }).strict(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export const uploadSessionDTOSchema: z.ZodType<UploadSessionDTO> = z.object({
  sessionId: z.string().uuid(),
  mediaId: z.string().uuid(),
  draftId: z.string().uuid(),
  role: z.enum(['main', 'trailer', 'extras', 'extra_image', 'intro', 'poster', 'poster_h', 'poster_v', 'subtitles', 'avatar']),
  slot: z.string().min(1).max(200),
  language: z.string().min(2).max(35).nullable(),
  state: z.enum(['provisioning', 'uploading', 'paused', 'uploaded', 'cancelling', 'cancelled', 'expired', 'failed']),
  revision,
  transferGeneration: z.number().int().positive(),
  expectedBytes: positiveSafeBytes,
  sourceSha256: digest,
  expiresAt: z.string().datetime({ offset: true }),
  receivedBytes: safeBytes,
  transferProgress: z.number().min(0).max(100),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
}).strict().refine((session) => session.receivedBytes <= session.expectedBytes, 'Los bytes recibidos superan el total');

export const uploadMutationEnvelopeSchema = z.object({
  version: z.literal(1),
  session: uploadSessionDTOSchema,
  asset: mediaAssetDTOSchema,
  draftRevision: revision,
  transfer: transferDescriptorSchema.optional(),
}).strict().refine((result) => result.session.mediaId === result.asset.mediaId, 'La sesión y el activo deben compartir identidad');

export const assetRoleSchema: z.ZodType<AssetRole> = z.enum([
  'main', 'trailer', 'extras', 'extra_image', 'intro', 'poster', 'poster_h', 'poster_v', 'subtitles', 'avatar',
]);

export type ParsedTransferDescriptor = TransferDescriptor;
export type ParsedMediaProof = MediaProof;
export type ParsedTransferState = TransferState;

export const transportGenerationSchema=z.object({generation:z.number().int().positive()}).strict();
export const transportRevisionSchema=z.object({revision}).strict();
export const transportResumeSchema=z.object({sha256:digest,bytes:positiveSafeBytes,revision}).strict();
export const transportRetrySchema=z.object({revision,asset_revision:revision,idempotency_key:z.string().uuid()}).strict();
export const transportPartSchema=z.object({number:z.number().int().positive(),generation:z.number().int().positive()}).strict();
