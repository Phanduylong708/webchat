import { Router } from "express";
import {
  getConversationsController,
  getConversationDetailsController,
  createGroupConversationController,
  addMemberToGroupController,
  leaveGroupController,
  removeMemberController,
  startPrivateConversationController,
} from "../controllers/conversation.controller.js";
import { passport } from "../../shared/config/passport.config.js";

export const conversationRoute = Router();

conversationRoute.get("/", passport.authenticate("jwt", { session: false }), getConversationsController);

conversationRoute.get(
  "/:conversationId",
  passport.authenticate("jwt", { session: false }),
  getConversationDetailsController,
);

conversationRoute.post(
  "/group",
  passport.authenticate("jwt", { session: false }),
  createGroupConversationController,
);

conversationRoute.post(
  "/:conversationId/members",
  passport.authenticate("jwt", { session: false }),
  addMemberToGroupController,
);

conversationRoute.delete(
  "/:conversationId/members/:userId",
  passport.authenticate("jwt", { session: false }),
  removeMemberController,
);

conversationRoute.delete(
  "/:conversationId/leave",
  passport.authenticate("jwt", { session: false }),
  leaveGroupController,
);

conversationRoute.post(
  "/private",
  passport.authenticate("jwt", { session: false }),
  startPrivateConversationController,
);
