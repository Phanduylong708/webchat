import { Router } from "express";
import { passport } from "../../shared/config/passport.config.js";
import {
  searchUserController,
  uploadMyAvatarController,
} from "../controllers/user.controller.js";
import { uploadAvatarMiddleware } from "../../shared/middlewares/upload.middleware.js";

const userRoutes = Router();

userRoutes.get(
  "/search",
  passport.authenticate("jwt", { session: false }),
  searchUserController
);

userRoutes.post(
  "/me/avatar",
  passport.authenticate("jwt", { session: false }),
  uploadAvatarMiddleware,
  uploadMyAvatarController
);

export { userRoutes };
