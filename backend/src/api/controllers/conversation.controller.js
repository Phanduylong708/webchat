import {
  getConversations,
  getConversationDetails,
  createGroupConversation,
  addMemberToGroup,
} from "../services/conversation.service.js";
import { parseId } from "../../shared/utils/parse.util.js";
import { sendSuccess } from "../../shared/utils/response.util.js";

async function getConversationsController(req, res, next) {
  try {
    const currentUserId = req.user.id; // user.id from prisma id always integer so no need check
    const conversations = await getConversations(currentUserId);
    return sendSuccess(res, {
      statusCode: 200,
      data: { conversations },
      message: "Conversations retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function getConversationDetailsController(req, res, next) {
  try {
    const conversationId = parseId(
      req.params.conversationId,
      "conversation ID"
    );
    const currentUserId = req.user.id;
    const conversationDetails = await getConversationDetails(
      conversationId,
      currentUserId
    );
    return sendSuccess(res, {
      statusCode: 200,
      data: { conversation: conversationDetails },
      message: "Conversation details retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function createGroupConversationController(req, res, next) {
  try {
    const { title, memberIds } = req.body;
    const currentUserId = req.user.id;
    const conversation = await createGroupConversation(
      currentUserId,
      title,
      memberIds
    );
    return sendSuccess(res, {
      statusCode: 201,
      data: { conversation },
      message: "Group conversation created successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function addMemberToGroupController(req, res, next) {
  try {
    const conversationIdParam = parseId(
      // helper to validate and parse ID params
      req.params.conversationId,
      "conversation ID"
    );
    const userId = parseId(req.body.userId, "user ID"); // parse userId from request body
    const currentUserId = req.user.id;

    const { conversationId, member } = await addMemberToGroup(
      conversationIdParam,
      currentUserId,
      userId
    );
    return sendSuccess(res, {
      statusCode: 201,
      data: { conversationId, member },
      message: "Member added to group conversation successfully",
    });
  } catch (error) {
    next(error);
  }
}

export {
  getConversationsController,
  getConversationDetailsController,
  createGroupConversationController,
  addMemberToGroupController,
};
