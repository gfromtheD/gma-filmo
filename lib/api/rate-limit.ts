// In-process fixed-window rate limiter.
// Works within a single Node.js instance. For multi-instance (Vercel serverless),
// replace with @upstash/ratelimit + @upstash/redis for distributed enforcement.

const store = new Map<string, { count: number; resetAt: number }>();

// Purge expired windows every 5 min so the Map never grows unboundedly
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 300_000).unref();

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Segundos que faltan para poder volver a intentarlo (solo si `allowed` es falso). */
  readonly retryAfterSeconds: number;
}

/** Como `rateLimit`, pero indica cuánto hay que esperar al bloquear (para la cabecera `Retry-After`). */
export function rateLimitCheck(key: string, limit: number, windowMs = 60_000, now = Date.now()): RateLimitResult {
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  return rateLimitCheck(key, limit, windowMs).allowed;
}
