import { Router } from "express";
import { passport } from "../../shared/config/passport.config.js";
import { uploadMediaMiddleware } from "../../shared/middlewares/upload.middleware.js";
import { uploadMediaController } from "../controllers/media.controller.js";

export const mediaRoutes = Router();

mediaRoutes.post(
  "/upload",
  passport.authenticate("jwt", { session: false }),
  uploadMediaMiddleware,
  uploadMediaController,
);
