import { Router } from "express";
import {
  getConversationsController,
  getConversationDetailsController,
  createGroupConversationController,
} from "../controllers/conversation.controller.js";
import { passport } from "../../shared/config/passport.config.js";

export const conversationRoute = Router();

conversationRoute.get(
  "/",
  passport.authenticate("jwt", { session: false }),
  getConversationsController
);

conversationRoute.get(
  "/:conversationId",
  passport.authenticate("jwt", { session: false }),
  getConversationDetailsController
);

conversationRoute.post(
  "/group",
  passport.authenticate("jwt", { session: false }),
  createGroupConversationController
);
