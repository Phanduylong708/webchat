import { socketAuthMiddleware } from "./middlewares/auth.middleware.js";
import { handleChatMessage } from "./handlers/chat.handler.js";
import { handleStatus } from "./handlers/status.handler.js";
import { Server } from "socket.io";

function initializeSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
    },
  });

  io.use(socketAuthMiddleware);
  io.on("connection", (socket) => {
    handleStatus(io, socket);
    handleChatMessage(io, socket);
  });
  return io;
}

export { initializeSocketServer };
