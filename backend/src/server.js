import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { initializeSocketServer } from "./sockets/index.js";
import { passport } from "./shared/config/passport.config.js";
import { sendErrors } from "./shared/utils/response.util.js";
import { authRoutes } from "./api/routes/auth.routes.js";
import { friendRoutes } from "./api/routes/friend.routes.js";
import { userRoutes } from "./api/routes/user.routes.js";
import { conversationRoute } from "./api/routes/conversation.routes.js";
import { messageRoute } from "./api/routes/message.routes.js";
import { mediaRoutes } from "./api/routes/media.routes.js";
import { cleanupStalePendingAttachments } from "./api/services/media.service.js";
import redis from "./shared/config/redis.config.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

const httpServer = createServer(app);
const io = initializeSocketServer(httpServer);
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/media", mediaRoutes);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.log("=== ERROR MIDDLEWARE TRIGGERED ===");
  console.log("Error object:", err);
  console.log("err.statusCode:", err.statusCode);
  console.log("err.message:", err.message);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Server Error:", err);
  sendErrors(res, { statusCode, message });
});
// Connect to Redis before starting the server
async function startServer() {
  try {
    await redis.connect();
    console.log("Connected to Redis successfully");
  } catch (error) {
    console.error("Failed to connect to Redis:", error.message);
  }

  httpServer.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
    // Non-blocking startup cleanup for stale pending attachments
    cleanupStalePendingAttachments()
      .then(({ deletedCount, cloudErrors }) => {
        if (deletedCount > 0) {
          console.log(
            `[startup-cleanup] Removed ${deletedCount} stale pending attachment(s) (cloud errors: ${cloudErrors})`,
          );
        }
      })
      .catch((error) => {
        console.warn("[startup-cleanup] Failed to clean stale attachments:", error.message);
      });
  });
}
startServer();
