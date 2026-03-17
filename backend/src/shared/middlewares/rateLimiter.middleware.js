import redis from "../config/redis.config.js";

// ── Rate limiter middleware ──────────────────────────────────────────────────

export function createRateLimiter({ limit, windowSec, keyPrefix }) {
  return async (req, res, next) => {
    const key = `rl:${keyPrefix}:${req.ip}`;

    try {
      const count = await redis.incr(key);

      // Start the fixed window on the first request
      if (count === 1) {
        await redis.expire(key, windowSec);
      }

      if (count > limit) {
        const ttl = await redis.ttl(key);
        res.set("Retry-After", String(ttl));
        return res.status(429).json({
          message: "Too many requests. Please try again later.",
          retryAfter: ttl,
        });
      }

      return next();
    } catch (err) {
      // Fail open so Redis issues do not block auth routes
      console.warn(`[rate-limiter] Redis error for key "${key}":`, err.message);
      return next();
    }
  };
}
