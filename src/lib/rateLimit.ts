import { safeRedis } from "./redis";

type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds?: number };

// In-memory fallback bucket, used only when Redis is not configured/reachable.
// Not shared across serverless instances — it's a best-effort backstop, not
// the primary defense. Redis is the real rate limiter in production.
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimiter(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - bucket.count };
}

/**
 * Fixed-window rate limiter. `scope` namespaces the counter
 * (e.g. "auth:google:callback", "ai:generate") and `identifier` is
 * typically an IP address or user ID.
 */
export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = `ratelimit:${scope}:${identifier}`;

  if (safeRedis.isConfigured()) {
    const count = await safeRedis.incrWithTtl(key, windowSeconds);
    if (count !== null) {
      if (count > limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
      }
      return { allowed: true, remaining: limit - count };
    }
    // Redis configured but unreachable right now — fail open to the
    // in-memory limiter rather than blocking all traffic.
  }

  return memoryLimiter(key, limit, windowSeconds);
}
