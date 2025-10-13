import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { passport } from "./shared/config/passport.config.js";
import { sendErrors } from "./shared/utils/response.util.js";
import { authRoutes } from "./api/routes/auth.routes.js";
import { friendRoutes } from "./api/routes/friend.routes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.use(passport.initialize());
app.use("/api/auth", authRoutes);
app.use("/api/friends", friendRoutes);
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Server Error:", err);
  sendErrors(res, { statusCode, message });
});
