import type { ImageLoaderProps } from 'next/image';

/** Selected only by the isolated local Next config; decorative remote art is fixture art. */
export function localFixtureImage({ src }: ImageLoaderProps): string {
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  return 'http://127.0.0.1:4319/fixtures/legacy.poster.webp';
}
export default localFixtureImage;
