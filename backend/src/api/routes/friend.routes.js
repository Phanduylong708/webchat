import { Router } from "express";
import { passport } from "../../shared/config/passport.config.js";
import {
  addFriendController,
  getFriendsController,
  removeFriendController,
} from "../controllers/friend.controller.js";

const friendRoutes = Router();

friendRoutes.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  addFriendController
);
friendRoutes.get(
  "/",
  passport.authenticate("jwt", { session: false }),
  getFriendsController
);
friendRoutes.delete(
  "/:friendId",
  passport.authenticate("jwt", { session: false }),
  removeFriendController
);

export { friendRoutes };
