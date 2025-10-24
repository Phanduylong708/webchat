import { findOrCreatePrivateConversation } from "../../api/services/conversation.service.js";
import { prisma } from "../../shared/prisma.js";
import { verifyMembership } from "../helpers/helpers.js";
import { getConversationRoom, getUserRoom } from "../helpers/helpers.js";

async function handleChatMessage(io, socket) {
  // Listen for incoming chat messages
  socket.on("sendMessage", async (payload, callback) => {
    try {
      if (typeof callback !== "function") {
        return;
      }

      const { conversationId, recipientId, content } = payload ?? {}; // Id of conversation, recipient, and message content
      // ambiguous payload check
      if (conversationId && recipientId) {
        return callback({
          success: false,
          error: "Cannot specify both conversationId and recipientId.",
        });
      }
      // as least one identifier check
      if (!conversationId && !recipientId) {
        return callback({
          success: false,
          error: "Must specify either conversationId or recipientId.",
        });
      }
      //validate content. Trim whitespace and check if empty
      if (!content || content.trim().length === 0) {
        return callback({
          success: false,
          error: "Message content cannot be empty.",
        });
      }

      const currentUserId = socket.data.user.id; // Authenticated user ID from socket
      let currentConversationId = conversationId; // Initialize conversation ID
      // If recipientId is provided, find or create private conversation
      if (recipientId) {
        try {
          const privateConversationId = await findOrCreatePrivateConversation(
            // find or create private conversation if needed
            currentUserId,
            recipientId
          );
          currentConversationId = privateConversationId; // Set current conversation ID to the private conversation ID
          io.in(getUserRoom(recipientId)).socketsJoin(
            getConversationRoom(currentConversationId)
          );
        } catch (err) {
          console.error("Error finding/creating private conversation:", err);
          return callback({ success: false, error: err.message });
        }
      }
      // if conversationId exists (user claim to be member), must verify membership
      if (conversationId) {
        const isMember = await verifyMembership(
          currentUserId,
          currentConversationId
        );
        if (!isMember) {
          return callback({
            success: false,
            error: "You are not a member of this conversation.",
          });
        }
      }

      // Create new message in the database
      const message = await prisma.$transaction(async (tx) => {
        const result = await tx.message.create({
          // create message
          data: {
            conversationId: currentConversationId,
            senderId: currentUserId,
            content,
            messageType: "TEXT",
          },
          include: {
            sender: { select: { id: true, username: true, avatar: true } },
          },
        });
        await tx.conversation.update({
          // update conversation's updatedAt for sort getConversations
          where: { id: currentConversationId },
          data: { updatedAt: new Date() },
        });
        return result;
      });

      //ensure sender joined room
      socket.join(getConversationRoom(currentConversationId));
      // Broadcast the new message to all members in the conversation room except sender
      socket
        .to(getConversationRoom(currentConversationId))
        .emit("newMessage", message);
      // Acknowledge successful message sending
      callback({ success: true, message });
    } catch (error) {
      console.error("Error handling sendMessage:", error);
      callback({ success: false, error: "Internal server error." });
    }
  });

  //typing indicator
  socket.on("typing:start", async (payload) => {
    try {
      const conversationId = parseInt(payload.conversationId, 10);
      if (isNaN(conversationId)) {
        console.warn("Invalid conversationId in typing:start");
        return;
      }
      const currentUserId = socket.data.user.id;
      const currentUsername = socket.data.user.username;
      // Verify membership
      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        console.warn(
          `User ${currentUserId} is not a member of conversation ${conversationId}`
        );
        return;
      }
      // Broadcast typing event to other members in the conversation room
      socket.to(getConversationRoom(conversationId)).emit("userTyping", {
        userId: currentUserId,
        username: currentUsername,
        conversationId,
        isTyping: true,
      });
    } catch (error) {
      console.warn("Error in typing:start handler:", error);
    }
  });

  // typing stop
  socket.on("typing:stop", async (payload) => {
    try {
      const conversationId = parseInt(payload.conversationId, 10);
      if (isNaN(conversationId)) {
        console.warn("Invalid conversationId in typing:stop");
        return;
      }
      const currentUserId = socket.data.user.id;
      const currentUsername = socket.data.user.username;
      // Verify membership
      const isMember = await verifyMembership(currentUserId, conversationId);
      if (!isMember) {
        console.warn(
          `User ${currentUserId} is not a member of conversation ${conversationId}`
        );
        return;
      }
      // Broadcast typing event to other members in the conversation room
      socket.to(getConversationRoom(conversationId)).emit("userTyping", {
        userId: currentUserId,
        username: currentUsername,
        conversationId,
        isTyping: false,
      });
    } catch (error) {
      console.warn("Error in typing:stop handler:", error);
    }
  });
}

export { handleChatMessage };
