import { Router } from "express";
import { passport } from "../../shared/config/passport.config.js";
import { getMessagesController } from "../controllers/message.controller.js";

export const messageRoute = Router();

messageRoute.get(
  "/:conversationId/",
  passport.authenticate("jwt", { session: false }),
  getMessagesController
);
