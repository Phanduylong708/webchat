import redis from "../config/redis.config.js";

async function cacheGet(key) {
  try {
    const value = await redis.get(key);

    if (!value) {
      return null;
    }
    return JSON.parse(value);
  } catch (error) {
    console.warn("[Cache] GET failed:", error.message);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    console.warn("[Cache] SET failed:", error.message);
  }
}

async function cacheDel(key) {
  try {
    await redis.del(key);
  } catch (error) {
    console.warn("[Cache] DEL failed:", error.message);
  }
}

export { cacheGet, cacheSet, cacheDel };
