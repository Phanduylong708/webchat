import { prisma } from "../../shared/prisma.js";
import { hashPassword } from "../../shared/utils/hash.util.js";

async function register(email, password, username) {
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
}

export { register };
