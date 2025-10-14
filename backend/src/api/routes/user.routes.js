import { Router } from "express";
import { passport } from "../../shared/config/passport.config.js";
import { searchUserController } from "../controllers/user.controller.js";

const userRoutes = Router();

userRoutes.get(
  "/search",
  passport.authenticate("jwt", { session: false }),
  searchUserController
);

export { userRoutes };
