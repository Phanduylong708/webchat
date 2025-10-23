import { prisma } from "../../shared/prisma.js";
import { hashPassword } from "../../shared/utils/hash.util.js";
import { createHTTPError } from "../../shared/utils/error.util.js";

async function register(email, password, username) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });
  if (existingUser) {
    throw createHTTPError(409, "Email or username already in use");
  }
  const hashedPassword = await hashPassword(password);
  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      username,
    },
    select: {
      id: true,
      email: true,
      username: true,
      createdAt: true,
      avatar: true,
    },
  });
  return newUser;
}

async function findUserByIdentifier(identifier) {
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
      avatar: true,
    },
  });
  return user;
}

export { register, findUserByIdentifier };
