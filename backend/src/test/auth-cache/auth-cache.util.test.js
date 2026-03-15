/* global jest, describe, it, expect, beforeEach */

jest.mock("../../shared/utils/cache.util.js", () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDel: jest.fn(),
}));

jest.mock("../../shared/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { cacheGet, cacheSet, cacheDel } from "../../shared/utils/cache.util.js";
import { prisma } from "../../shared/prisma.js";
import { getCachedUser, invalidateUserCache } from "../../shared/utils/auth-cache.util.js";

const MOCK_USER = {
  id: 1,
  email: "alice@example.com",
  username: "alice",
  avatar: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("getCachedUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns cached user on cache hit without querying DB", async () => {
    const cachedUser = { ...MOCK_USER, createdAt: "2026-01-01T00:00:00.000Z" };
    cacheGet.mockResolvedValue(cachedUser);

    const result = await getCachedUser(1);

    expect(result).toEqual(MOCK_USER);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("queries DB and populates cache on cache miss", async () => {
    cacheGet.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(MOCK_USER);

    const result = await getCachedUser(1);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, email: true, username: true, avatar: true, createdAt: true },
    });
    expect(cacheSet).toHaveBeenCalledWith("session:1", MOCK_USER, 1800);
    expect(result).toEqual(MOCK_USER);
  });

  it("returns null and does not populate cache when user does not exist in DB", async () => {
    cacheGet.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await getCachedUser(99);

    expect(result).toBeNull();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("uses the correct cache key format", async () => {
    cacheGet.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(MOCK_USER);

    await getCachedUser(42);

    expect(cacheGet).toHaveBeenCalledWith("session:42");
    expect(cacheSet).toHaveBeenCalledWith("session:42", MOCK_USER, expect.any(Number));
  });
});

describe("invalidateUserCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the correct cache key", async () => {
    cacheDel.mockResolvedValue(undefined);

    await invalidateUserCache(1);

    expect(cacheDel).toHaveBeenCalledWith("session:1");
    expect(cacheDel).toHaveBeenCalledTimes(1);
  });
});
