import { prisma } from "../../shared/prisma.js";
import { createHTTPError } from "../../shared/utils/error.util.js";

async function searchUserByUsername(username) {
  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      avatar: true,
      isOnline: true,
      lastSeen: true,
    },
  });
  if (!existingUser) {
    throw createHTTPError(404, "User not found");
  }
  return existingUser;
}

export { searchUserByUsername };
