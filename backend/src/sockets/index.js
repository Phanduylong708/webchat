import { socketAuthMiddleware } from "./middlewares/auth.middleware.js";
import { handleChatMessage } from "./handlers/chat.handler.js";
import { handleStatus } from "./handlers/status.handler.js";
import { handleCall } from "./handlers/call.handler.js";
import { Server } from "socket.io";

function initializeSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
    // Enable connection state recovery for smoother reconnection
    connectionStateRecovery: {
      maxDisconnectionDuration: 120 * 1000, // 2 minutes
    },
  });

  io.use(socketAuthMiddleware);
  io.on("connection", (socket) => {
    // Track whether Socket.IO recovered prior rooms/packets after a transient drop
    const isRecovered = socket.recovered === true;
    socket.data.isRecovered = isRecovered;
    console.log(`Socket: ${socket.id} recovered: ${isRecovered}`);
    handleStatus(io, socket);
    handleChatMessage(io, socket);
    handleCall(io, socket);
  });
  return io;
}

export { initializeSocketServer };
