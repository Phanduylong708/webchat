import { prisma } from "../../shared/prisma.js";
import { verifyToken } from "../../shared/utils/jwt.util.js";

async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(makeError("Unauthorized Socket", "AUTH_MISSING_TOKEN"));
    }
    const payload = verifyToken(token);
    if (!payload) {
      return next(makeError("Unauthorized Socket", "AUTH_INVALID_TOKEN"));
    }
    const userId = payload.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, avatar: true },
    });
    if (!user) {
      return next(makeError("Unauthorized Socket", "AUTH_USER_NOT_FOUND"));
    }
    socket.data.user = user;
    next();
  } catch (err) {
    console.error("Socket Authentication Error:", err);
    return next(makeError("Unauthorized Socket", "AUTH_ERROR"));
  }
}

function makeError(message, code) {
  const err = new Error(message);
  err.data = { code };
  return err;
}

export { socketAuthMiddleware };
