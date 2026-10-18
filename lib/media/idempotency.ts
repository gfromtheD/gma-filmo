import { createHash } from 'node:crypto';
import { MEDIA_ERROR_CODES, MediaError } from './errors';
import type { JsonValue } from '@/types/media-engine';

export interface CanonicalHashOptions {
  /** Fields omitted from the root request object, such as the CAS revision of a reserve. */
  omitTopLevel?: readonly string[];
}

const MAX_CANONICAL_DEPTH = 64;
const MAX_CANONICAL_NODES = 100_000;

function invalidRequest(cause?: unknown): MediaError {
  return new MediaError(MEDIA_ERROR_CODES.invalidInput, { cause });
}

function normalizeJson(
  value: unknown,
  omitTopLevel: ReadonlySet<string>,
  stack: Set<object>,
  depth: number,
  nodeCount: { value: number },
  root: boolean,
): JsonValue {
  nodeCount.value += 1;
  if (nodeCount.value > MAX_CANONICAL_NODES || depth > MAX_CANONICAL_DEPTH) throw invalidRequest();

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw invalidRequest();
    return value;
  }

  if (typeof value !== 'object') throw invalidRequest();
  if (stack.has(value)) throw invalidRequest();
  stack.add(value);

  try {
    if (Array.isArray(value)) {
      const normalized: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw invalidRequest();
        normalized.push(normalizeJson(value[index], omitTopLevel, stack, depth + 1, nodeCount, false));
      }
      const enumerableKeys = Object.keys(value);
      if (enumerableKeys.some((key) => !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) {
        throw invalidRequest();
      }
      return normalized;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw invalidRequest();
    if (Object.getOwnPropertySymbols(value).length > 0) throw invalidRequest();

    const normalized = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(value).sort()) {
      if (root && omitTopLevel.has(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw invalidRequest();
      normalized[key] = normalizeJson(descriptor.value, omitTopLevel, stack, depth + 1, nodeCount, false);
    }
    return normalized;
  } finally {
    stack.delete(value);
  }
}

/** Hashes JSON requests with sorted object keys while preserving array order. */
export function canonicalRequestHash(input: unknown, options: CanonicalHashOptions = {}): string {
  if (input === null || Array.isArray(input) || typeof input !== 'object') throw invalidRequest();
  const omitted = new Set(options.omitTopLevel ?? []);
  if ([...omitted].some((key) => key.length === 0)) throw invalidRequest();

  const canonical = normalizeJson(input, omitted, new Set(), 0, { value: 0 }, true);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
