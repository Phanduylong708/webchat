import { prisma } from "../../shared/prisma.js";
import { hashPassword } from "../../shared/utils/hash.util.js";

async function register(email, password, username) {
  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
    if (existingUser) {
      const error = new Error("Email or username already in use");
      error.statusCode = 409;
      throw error;
    }
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
      },
      select: { id: true, email: true, username: true, createdAt: true },
    });
    return newUser;
  } catch (error) {
    throw error;
  }
}

async function findUserByIdentifier(identifier) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        createdAt: true,
      },
    });
    return user;
  } catch (error) {
    throw error;
  }
}

export { register, findUserByIdentifier };
