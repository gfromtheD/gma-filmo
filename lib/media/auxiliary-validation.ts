import sharp from 'sharp';

export class AuxiliaryValidationError extends Error {
  constructor(readonly code: 'SUBTITLE_INVALID' | 'IMAGE_INVALID' | 'NORMALIZED_ASSET_TOO_LARGE') { super(code); }
}

export function normalizeSubtitles(input: Uint8Array): Buffer {
  let decoded: string;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(input); }
  catch { throw new AuxiliaryValidationError('SUBTITLE_INVALID'); }
  const text = decoded.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text || text.includes('\0') || /<(?:script|iframe|style)\b/i.test(text)) throw new AuxiliaryValidationError('SUBTITLE_INVALID');
  const body = text.replace(/^WEBVTT[^\n]*(?:\n[^\n]+)*?\n\n/, '').replace(/^WEBVTT\s*$/, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  const timestamp = (value: string) => {
    const parts = value.split(':'); const seconds = Number(parts.pop()); const minutes = Number(parts.pop()); const hours = Number(parts.pop() ?? 0);
    if (!Number.isFinite(seconds) || minutes > 59 || seconds >= 60) throw new AuxiliaryValidationError('SUBTITLE_INVALID');
    return hours * 3600 + minutes * 60 + seconds;
  };
  const cues: string[] = [];
  for (const block of body.split(/\n\s*\n/)) {
    if (/^NOTE(?:\s|$)/.test(block)) continue;
    const lines = block.trim().split('\n'); const index = lines[0]?.includes('-->') ? 0 : 1;
    const timing = lines[index]?.match(/^((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})(?:\s+[^\n]*)?$/);
    if (!timing || lines.length <= index + 1 || timestamp(timing[1]!) >= timestamp(timing[2]!)) throw new AuxiliaryValidationError('SUBTITLE_INVALID');
    const content = lines.slice(index + 1).join('\n');
    if (content.includes('-->') || content.length > 20_000) throw new AuxiliaryValidationError('SUBTITLE_INVALID');
    cues.push(`${timing[1]} --> ${timing[2]}\n${content}`);
  }
  if (!cues.length || cues.length > 50_000) throw new AuxiliaryValidationError('SUBTITLE_INVALID');
  return Buffer.from(`WEBVTT\n\n${cues.join('\n\n')}\n`);
}

export interface NormalizedImage { data: Buffer; width: number; height: number; mimeType: 'image/webp' }
export async function normalizeImage(input: Uint8Array, role: string): Promise<NormalizedImage> {
  try {
    const image = sharp(input, { limitInputPixels: 25_000_000, animated: false });
    const metadata = await image.metadata();
    // sharp informa de un AVIF como `heif` con compresión AV1; un HEIC (foto de iPhone, HEVC) no se admite.
    const isAvif = metadata.format === 'heif' && metadata.compression === 'av1';
    if (!(['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || isAvif) || !metadata.width || !metadata.height) {
      throw new AuxiliaryValidationError('IMAGE_INVALID');
    }
    const normalized = await image.rotate().resize({ width: role === 'avatar' ? 512 : 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).timeout({ seconds: 20 }).toBuffer({ resolveWithObject: true });
    if (normalized.data.length > 4 * 1024 ** 2) throw new AuxiliaryValidationError('NORMALIZED_ASSET_TOO_LARGE');
    return { data: normalized.data, width: normalized.info.width, height: normalized.info.height, mimeType: 'image/webp' };
  } catch (error) {
    if (error instanceof AuxiliaryValidationError) throw error;
    throw new AuxiliaryValidationError('IMAGE_INVALID');
  }
}
