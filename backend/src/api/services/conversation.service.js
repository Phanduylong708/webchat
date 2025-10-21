import { prisma } from "../../shared/prisma.js";

async function getConversations(userId) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, avatar: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
              sender: { select: { id: true, username: true, avatar: true } },
            },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const conversations = memberships.map(({ conversation }) => {
    // 📩 Get the latest message for preview
    // Assumes `conversation.messages` is sorted by createdAt DESC (newest first)
    const lastMessage = conversation.messages[0] || null;

    // 👤 If this is a PRIVATE conversation (1-on-1 chat)
    if (conversation.type === "PRIVATE") {
      // Find the other participant (exclude the current user)
      const otherMember = conversation.members.find(
        (member) => member.userId !== userId
      );

      // Extract that user's profile if found
      const otherUser = otherMember ? otherMember.user : null;

      // Return a simplified object for private chats:
      // - No title (direct messages usually don’t have one)
      // - Includes info about the other user for the chat list
      // - Includes the latest message for preview
      return {
        id: conversation.id,
        type: conversation.type,
        title: null,
        otherUser: otherUser
          ? {
              id: otherUser.id,
              username: otherUser.username,
              avatar: otherUser.avatar,
            }
          : null,
        lastMessage,
      };
    }

    // 👥 If this is a GROUP conversation
    // Build a small "preview" list of up to 3 other members for UI display
    const previewMembers = conversation.members
      // Exclude the current user from the preview
      .filter((member) => member.userId !== userId)
      // Limit to 3 members to keep the preview compact
      .slice(0, 3)
      // Extract only basic user info needed for rendering
      .map(({ user }) => ({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      }));

    // Return a more detailed object for group chats:
    // - Includes the group title and total member count
    // - Includes a preview of up to 3 members
    // - Includes the latest message for preview
    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      memberCount: conversation.members.length,
      previewMembers,
      lastMessage,
    };
  });

  return conversations;
}

async function getConversationDetails(conversationId, userId) {
  const isMember = await prisma.conversationMember.findUnique({
    where: {
      userId_conversationId: { userId, conversationId },
    },
  });
  if (!isMember) {
    const error = new Error("Not a member of conversation");
    error.statusCode = 403;
    throw error;
  }
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, avatar: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    const error = new Error("Conversation not found");
    error.statusCode = 404;
    throw error;
  }
  const members = conversation.members.map((member) => {
    return {
      id: member.user.id,
      username: member.user.username,
      avatar: member.user.avatar,
    };
  });
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    creatorId: conversation.creatorId,
    members,
  };
}

export { getConversations, getConversationDetails };
