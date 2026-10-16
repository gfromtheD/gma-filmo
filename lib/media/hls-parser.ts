import path from 'node:path';
import { MediaError } from './errors';

export const MAX_HLS_BYTES = 1024 * 1024;
export const MAX_HLS_REFERENCES = 10_000;
export const MAX_HLS_DEPTH = 4;
const invalid = () => new MediaError('MEDIA_PLAYBACK_UNSUPPORTED');

export interface ParsedMediaHls {
  references: readonly string[];
  rewrite(resolve: (relative: string) => string): string;
}

/** Separate from the MPEG-TS-only historical R2 helper. Every URI is resolved inside one asset namespace. */
export function resolveHlsReference(playlist: string, value: string): string {
  for (const candidate of [playlist, value]) {
    if (!/^[a-zA-Z0-9_./-]{1,512}$/.test(candidate) || candidate.startsWith('/')
      || candidate.split('/').some(part => !part || part === '.' || part === '..')) throw invalid();
  }
  const resolved = path.posix.join(path.posix.dirname(playlist), value);
  if (resolved.length > 512 || resolved.split('/').length > MAX_HLS_DEPTH + 1) throw invalid();
  return resolved;
}

interface Attribute { name: string; value: string; quoted: boolean }
function parseAttributes(value: string): Attribute[] {
  const fields: string[] = []; let quoted = false; let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '"') quoted = !quoted;
    if (value[i] === ',' && !quoted) { fields.push(value.slice(start, i)); start = i + 1; }
  }
  if (quoted) throw invalid(); fields.push(value.slice(start));
  const names = new Set<string>();
  return fields.map(field => {
    const match = /^([A-Z0-9-]+)=(.+)$/.exec(field); if (!match || names.has(match[1]!)) throw invalid();
    const name = match[1]!; names.add(name); const raw = match[2]!;
    const isQuoted = raw.startsWith('"');
    if (isQuoted ? !/^"[^"\\\r\n]*"$/.test(raw) : /["\s]/.test(raw)) throw invalid();
    return { name, value: isQuoted ? raw.slice(1, -1) : raw, quoted: isQuoted };
  });
}

/** Bounded parser: URI lines plus quoted MAP/MEDIA/I-FRAME attributes; encrypted-key URLs fail closed. */
export function parseMediaHls(text: string, playlist: string, resolveReference: (value: string) => string = value => resolveHlsReference(playlist, value)): ParsedMediaHls {
  if (Buffer.byteLength(text) > MAX_HLS_BYTES || !text.startsWith('#EXTM3U\n') && !text.startsWith('#EXTM3U\r\n')
    || /[^\x09\x0a\x0d\x20-\x7e\u0080-\uffff]/.test(text)) throw invalid();
  resolveHlsReference(playlist, 'check');
  const references: string[] = [];
  const reference = (value: string) => {
    const relative = resolveReference(value); resolveHlsReference('master.m3u8', relative); references.push(relative);
    if (references.length > MAX_HLS_REFERENCES) throw invalid(); return relative;
  };
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(line => {
    if (!line || line === '#EXTM3U') return () => line;
    if (!line.startsWith('#')) {
      const relative = reference(line); return (resolve: (relative: string) => string) => resolve(relative);
    }
    const tag = /^#(EXT-X-[A-Z0-9-]+):(.*)$/.exec(line);
    if (tag && ['EXT-X-MAP', 'EXT-X-MEDIA', 'EXT-X-I-FRAME-STREAM-INF', 'EXT-X-KEY'].includes(tag[1]!)) {
      const attributes = parseAttributes(tag[2]!); const uri = attributes.find(attribute => attribute.name === 'URI');
      if (tag[1] === 'EXT-X-KEY') {
        if (attributes.length !== 1 || attributes[0]?.name !== 'METHOD' || attributes[0].value !== 'NONE' || attributes[0].quoted) throw invalid();
        return () => line;
      }
      if (!uri && tag[1] !== 'EXT-X-MEDIA' || uri && !uri.quoted) throw invalid();
      const relative = uri ? reference(uri.value) : null;
      return (resolve: (relative: string) => string) => `#${tag[1]}:${attributes.map(attribute => {
        const value = attribute.name === 'URI' && relative ? resolve(relative) : attribute.value;
        return `${attribute.name}=${attribute.quoted ? `"${value}"` : value}`;
      }).join(',')}`;
    }
    if (/\bURI\s*=/i.test(line) || /^#EXT-X-(SESSION-KEY|CONTENT-STEERING|DEFINE)(:|$)/.test(line)) throw invalid();
    return () => line;
  });
  return { references, rewrite: resolve => lines.map(line => line(resolve)).join('\n') };
}
