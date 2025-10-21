import {
  getConversations,
  getConversationDetails,
  createGroupConversation,
} from "../services/conversation.service.js";
import { sendSuccess, sendErrors } from "../../shared/utils/response.util.js";

async function getConversationsController(req, res, next) {
  try {
    const userId = req.user.id;
    if (isNaN(userId)) {
      return sendErrors(res, {
        statusCode: 400,
        message: "Invalid user ID",
      });
    }
    const conversations = await getConversations(userId);
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
    const conversationId = parseInt(req.params.conversationId, 10);
    if (isNaN(conversationId)) {
      return sendErrors(res, {
        statusCode: 400,
        message: "Invalid conversation ID",
      });
    }

    const userId = req.user.id;
    const conversationDetails = await getConversationDetails(
      conversationId,
      userId
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
    const userId = req.user.id;
    const conversation = await createGroupConversation(
      userId,
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

export {
  getConversationsController,
  getConversationDetailsController,
  createGroupConversationController,
};
