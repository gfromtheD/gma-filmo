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

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
