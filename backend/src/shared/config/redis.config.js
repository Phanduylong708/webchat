import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
  },
});

redis.on("error", (err) => console.error("Redis Client Error", err.message));

export default redis;
