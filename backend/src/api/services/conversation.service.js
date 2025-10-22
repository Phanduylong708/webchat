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
    // Get the latest message for preview
    // Assumes `conversation.messages` is sorted by createdAt DESC (newest first)
    const lastMessage = conversation.messages[0] || null;

    // If this is a PRIVATE conversation (1-on-1 chat)
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

    // If this is a GROUP conversation
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

async function createGroupConversation(userId, title, memberIds) {
  //validate title
  if (!title || title.trim().length === 0) {
    const error = new Error("Title is required for group conversations");
    error.statusCode = 400;
    throw error;
  }

  memberIds = memberIds || [];
  //validate memberIds
  if (!Array.isArray(memberIds)) {
    const error = new Error("memberIds must be an array of user IDs");
    error.statusCode = 400;
    throw error;
  }

  const uniqueIds = [...new Set(memberIds)] // remove duplicates
    .map((id) => Number(id)) // convert to numbers
    .filter((id) => Number.isInteger(id) && id !== userId); // filter out invalid IDs and the creator's ID

  if (uniqueIds.length < 2) {
    // at least 2 members besides the creator
    const error = new Error(
      "At least two valid member IDs (excluding the creator) are required to create a group conversation"
    );
    error.statusCode = 400;
    throw error;
  }

  const foundUsers = await prisma.user.findMany({
    // validate that all member IDs exist
    where: { id: { in: uniqueIds } },
  });

  if (foundUsers.length !== uniqueIds.length) {
    // some IDs do not correspond to existing users
    const error = new Error("One or more members not found");
    error.statusCode = 404;
    throw error;
  }
  const conversation = await prisma.$transaction(async (tx) => {
    const createdConversation = await tx.conversation.create({
      data: {
        type: "GROUP",
        title: title.trim(),
        creatorId: userId,
      },
    });

    await tx.conversationMember.create({
      data: {
        conversationId: createdConversation.id,
        userId,
      },
    });

    await tx.conversationMember.createMany({
      data: uniqueIds.map((memberId) => ({
        conversationId: createdConversation.id,
        userId: memberId,
      })),
      skipDuplicates: true,
    });

    return createdConversation;
  });

  return getConversationDetails(conversation.id, userId);
}

async function addMemberToGroup(conversationId, currentUserId, newUserId) {
  const conversation = await prisma.conversation.findUnique({
    // find conversation and members
    where: { id: conversationId },
    include: { members: true },
  });

  if (!conversation) {
    // check if conversation exists
    const error = new Error("Conversation not found");
    error.statusCode = 404;
    throw error;
  }

  if (conversation.type !== "GROUP") {
    // check if conversation is group type
    const error = new Error("Cannot add members to a private conversation");
    error.statusCode = 400;
    throw error;
  }

  if (conversation.creatorId !== currentUserId) {
    // check if current user is creator
    const error = new Error("Only the conversation creator can add members");
    error.statusCode = 403;
    throw error;
  }

  const newUser = await prisma.user.findUnique({
    // check if new user exists
    where: { id: newUserId },
    select: { id: true, username: true, avatar: true },
  });
  if (!newUser) {
    const error = new Error("User to be added not found");
    error.statusCode = 404;
    throw error;
  }

  //check if new user is already a member
  const isAlreadyMember = conversation.members.some(
    (member) => member.userId === newUserId
  );
  if (isAlreadyMember) {
    const error = new Error("User is already a member of the conversation");
    error.statusCode = 409;
    throw error;
  }

  await prisma.conversationMember.create({
    // add new member
    data: {
      conversationId,
      userId: newUserId,
    },
  });

  return { conversationId, member: newUser }; // return conversation ID and new member info
}
export {
  getConversations,
  getConversationDetails,
  createGroupConversation,
  addMemberToGroup,
};
