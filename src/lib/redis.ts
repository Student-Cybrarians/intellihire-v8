import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Ephemeral-state cache (OAuth state/nonce, rate-limit counters, permission
 * cache). The database remains authoritative for persistent identity and
 * security state — Redis is an optimization, never a source of truth, so
 * every consumer of this wrapper must degrade gracefully when Redis is down.
 */
class SafeRedis {
  private client: Redis | null = null;
  private connectFailed = false;

  private get(): Redis | null {
    if (this.connectFailed) return null;
    if (!env.REDIS_URL) return null;

    if (!this.client) {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
        lazyConnect: true,
      });
      this.client.on("error", (err) => {
        logger.warn({ err: err.message }, "redis_error");
      });
    }
    return this.client;
  }

  async setEx(key: string, seconds: number, value: string): Promise<boolean> {
    try {
      const client = this.get();
      if (!client) return false;
      await client.set(key, value, "EX", seconds);
      return true;
    } catch (err) {
      logger.warn({ err: (err as Error).message, key }, "redis_setex_failed");
      return false;
    }
  }

  /** Atomically fetch-and-delete — used for one-time-use OAuth state/nonce. */
  async takeOnce(key: string): Promise<string | null> {
    try {
      const client = this.get();
      if (!client) return null;
      const script = `
        local v = redis.call("GET", KEYS[1])
        if v then redis.call("DEL", KEYS[1]) end
        return v
      `;
      const result = (await client.eval(script, 1, key)) as string | null;
      return result;
    } catch (err) {
      logger.warn({ err: (err as Error).message, key }, "redis_takeonce_failed");
      return null;
    }
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    try {
      const client = this.get();
      if (!client) return null;
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      logger.warn({ err: (err as Error).message, key }, "redis_incr_failed");
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      const client = this.get();
      if (!client) return;
      await client.del(key);
    } catch (err) {
      logger.warn({ err: (err as Error).message, key }, "redis_del_failed");
    }
  }

  isConfigured(): boolean {
    return Boolean(env.REDIS_URL);
  }
}

export const safeRedis = new SafeRedis();
