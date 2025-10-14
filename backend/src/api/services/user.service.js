import { prisma } from "../../shared/prisma.js";

async function searchUserByUsername(username) {
  try {
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
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    return existingUser;
  } catch (error) {
    throw error;
  }
}

export { searchUserByUsername };
