import type { AssetRole } from '@/types/media-engine';

export function studioAssetSlot(role: AssetRole, language: string | null | undefined): string {
  return role === 'subtitles' ? `subtitles:${language ?? 'und'}` : role;
}
