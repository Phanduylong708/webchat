import {
  getConversations,
  getConversationDetails,
  createGroupConversation,
  addMemberToGroup,
  leaveGroup,
  removeMember,
  findOrCreatePrivateConversation,
} from "../services/conversation.service.js";
import { parseId } from "../../shared/utils/parse.util.js";
import { sendSuccess } from "../../shared/utils/response.util.js";
import { getUserRoom, getConversationRoom } from "../../sockets/helpers/helpers.js";
import { createHTTPError } from "../../shared/utils/error.util.js";
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
    const conversationId = parseId(req.params.conversationId, "conversation ID");
    const currentUserId = req.user.id;
    const conversationDetails = await getConversationDetails(conversationId, currentUserId);
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
    const io = req.io;
    if (!io) {
      throw createHTTPError(500, "Socket server not initialized");
    }
    const conversation = await createGroupConversation(currentUserId, title, memberIds);

    const conversationRoom = getConversationRoom(conversation.id);
    const processedUserIds = new Set();
    conversation.members.forEach((member) => {
      if (processedUserIds.has(member.id)) return;
      processedUserIds.add(member.id);
      const userRoom = getUserRoom(member.id);
      io.in(userRoom).socketsJoin(conversationRoom);
      io.to(userRoom).emit("addedToConversation", { conversation });
    });

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
      "conversation ID",
    );
    const io = req.io;
    if (!io) {
      throw createHTTPError(500, "Socket server not initialized");
    }
    const userId = parseId(req.body.userId, "user ID"); // parse userId from request body
    const currentUserId = req.user.id;

    const { conversationId, conversation, member } = await addMemberToGroup(
      conversationIdParam,
      currentUserId,
      userId,
    );

    io.in(getUserRoom(member.id)).socketsJoin(getConversationRoom(conversationId));
    io.to(getConversationRoom(conversationId)).emit("memberAdded", {
      conversationId,
      member,
    });
    io.to(getUserRoom(member.id)).emit("addedToConversation", { conversation });

    return sendSuccess(res, {
      statusCode: 201,
      data: { conversationId, member },
      message: "Member added to group conversation successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function leaveGroupController(req, res, next) {
  try {
    const conversationId = parseId(req.params.conversationId, "conversation ID");
    const io = req.io;
    if (!io) {
      throw createHTTPError(500, "Socket server not initialized");
    }
    const currentUserId = req.user.id;
    const { user } = await leaveGroup(conversationId, currentUserId);
    io.in(getUserRoom(currentUserId)).socketsLeave(getConversationRoom(conversationId));
    io.to(getConversationRoom(conversationId)).emit("memberLeft", {
      conversationId,
      userId: currentUserId,
      user,
    });
    return sendSuccess(res, {
      statusCode: 200,
      message: "Left group conversation successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function removeMemberController(req, res, next) {
  try {
    const conversationId = parseId(req.params.conversationId, "conversation ID");
    const targetUserId = parseId(req.params.userId, "user ID");
    const currentUserId = req.user.id;
    const io = req.io;
    if (!io) {
      throw createHTTPError(500, "Socket server not initialized");
    }

    const removedUser = await removeMember(conversationId, currentUserId, targetUserId);

    io.in(getUserRoom(removedUser.id)).socketsLeave(getConversationRoom(conversationId));
    io.to(getUserRoom(removedUser.id)).emit("youWereKicked", { conversationId });
    io.to(getConversationRoom(conversationId)).emit("memberLeft", {
      conversationId,
      userId: removedUser.id,
      user: removedUser,
    });

    return sendSuccess(res, {
      statusCode: 200,
      message: "Member removed successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function startPrivateConversationController(req, res, next) {
  try {
    const recipientId = parseId(req.body.recipientId, "recipient ID");
    const currentUserId = req.user.id;
    const io = req.io;
    if (!io) {
      throw createHTTPError(500, "Socket server not initialized");
    }

    const conversationId = await findOrCreatePrivateConversation(currentUserId, recipientId);

    const conversation = await getConversationDetails(conversationId, currentUserId);

    const conversationRoom = getConversationRoom(conversationId);
    const currentUserRoom = getUserRoom(currentUserId);
    const recipientRoom = getUserRoom(recipientId);

    io.in(currentUserRoom).socketsJoin(conversationRoom);
    io.in(recipientRoom).socketsJoin(conversationRoom);

    io.to(currentUserRoom).emit("addedToConversation", { conversation });
    io.to(recipientRoom).emit("addedToConversation", { conversation });

    return sendSuccess(res, {
      statusCode: 200,
      data: { conversationId },
      message: "Private conversation started successfully",
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
  leaveGroupController,
  removeMemberController,
  startPrivateConversationController,
};
