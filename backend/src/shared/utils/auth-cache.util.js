import { cacheGet, cacheSet, cacheDel } from "./cache.util.js";
import { prisma } from "../prisma.js";

const SESSION_CACHE_TTL = 30 * 60; // 30 minutes

/**
 * Returns the cached session user, falling back to DB on cache miss.
 *
 * Shape: { id, email, username, avatar, createdAt }
 */
async function getCachedUser(userId) {
  const cacheKey = `session:${userId}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, createdAt: new Date(cached.createdAt) };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, avatar: true, createdAt: true },
  });

  if (!user) return null;

  await cacheSet(cacheKey, user, SESSION_CACHE_TTL);
  return user;
}

/**
 * Invalidates the session cache for a user.
 *
 * MUST be called after any mutation to fields stored in the session cache:
 *   { id, email, username, avatar, createdAt }
 * Also call for operations that should immediately revoke access:
 *   account deletion, password change, account suspension, email change.
 */
async function invalidateUserCache(userId) {
  await cacheDel(`session:${userId}`);
}

export { getCachedUser, invalidateUserCache };
