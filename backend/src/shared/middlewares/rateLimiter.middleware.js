import redis from "../config/redis.config.js";

// ── Core ─────────────────────────────────────────────────────────────────────

export async function checkRateLimit({ key, limit, windowSec }) {
  try {
    const count = await redis.incr(key);

    // Start the fixed window on the first request
    if (count === 1) {
      await redis.expire(key, windowSec);
    }

    if (count > limit) {
      const retryAfter = await redis.ttl(key);
      return { allowed: false, retryAfter };
    }

    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    // Fail open so Redis issues do not block requests
    console.warn(`[rate-limiter] Redis error for key "${key}":`, err.message);
    return { allowed: true, retryAfter: 0 };
  }
}

// ── Express middleware ────────────────────────────────────────────────────────

export function createRateLimiter({ limit, windowSec, keyPrefix }) {
  return async (req, res, next) => {
    const key = `rl:${keyPrefix}:${req.ip}`;
    const { allowed, retryAfter } = await checkRateLimit({ key, limit, windowSec });

    if (!allowed) {
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
        retryAfter,
      });
    }

    return next();
  };
}
