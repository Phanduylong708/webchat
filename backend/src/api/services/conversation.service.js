import { prisma } from "../../shared/prisma.js";
import { createHTTPError } from "../../shared/utils/error.util.js";

/**
 * Derive a preview-text key from a last message.
 * Returns content if present; otherwise a mime-family key ("image"/"video"/"file").
 */
function derivePreviewText(message) {
  if (message.content && message.content.trim().length > 0) {
    return message.content;
  }
  const firstAttachment = message.attachments?.[0];
  if (firstAttachment?.mimeType) {
    if (firstAttachment.mimeType.startsWith("image/")) return "image";
    if (firstAttachment.mimeType.startsWith("video/")) return "video";
    return "file";
  }
  switch (message.messageType) {
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "FILE":
      return "file";
    default:
      return "";
  }
}

function serializeLatestPinnedMessage(latestPin) {
  if (!latestPin) {
    return null;
  }

  return {
    id: latestPin.message.id,
    previewText: derivePreviewText(latestPin.message),
    messageType: latestPin.message.messageType,
    pinnedAt: latestPin.pinnedAt.toISOString(),
  };
}

function buildPinSummary(pinnedCount, latestPin) {
  if (!pinnedCount) {
    return null;
  }

  return {
    pinnedCount,
    latestPinnedMessage: serializeLatestPinnedMessage(latestPin),
  };
}

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
            where: { deletedAt: null },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              content: true,
              messageType: true,
              createdAt: true,
              senderId: true,
              sender: { select: { id: true, username: true, avatar: true } },
              attachments: {
                take: 1,
                select: { mimeType: true },
              },
            },
          },
          pins: {
            where: { message: { deletedAt: null } },
            orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              pinnedAt: true,
              message: {
                select: {
                  id: true,
                  content: true,
                  messageType: true,
                  attachments: {
                    take: 1,
                    select: { mimeType: true },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              pins: {
                where: { message: { deletedAt: null } },
              },
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
    const rawLastMessage = conversation.messages[0] || null;
    const lastMessage = rawLastMessage
      ? {
          ...rawLastMessage,
          previewText: derivePreviewText(rawLastMessage),
        }
      : null;
    const pinSummary = buildPinSummary(conversation._count.pins, conversation.pins[0] ?? null);

    // If this is a PRIVATE conversation (1-on-1 chat)
    if (conversation.type === "PRIVATE") {
      // Find the other participant (exclude the current user)
      const otherMember = conversation.members.find((member) => member.userId !== userId);

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
        pinSummary,
        pinPermission: conversation.pinPermission,
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
      pinSummary,
      pinPermission: conversation.pinPermission,
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
    throw createHTTPError(403, "Not a member of conversation");
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
      pins: {
        where: { message: { deletedAt: null } },
        orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          pinnedAt: true,
          message: {
            select: {
              id: true,
              content: true,
              messageType: true,
              attachments: {
                take: 1,
                select: { mimeType: true },
              },
            },
          },
        },
      },
      _count: {
        select: {
          pins: {
            where: { message: { deletedAt: null } },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw createHTTPError(404, "Conversation not found");
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
    pinSummary: buildPinSummary(conversation._count.pins, conversation.pins[0] ?? null),
    pinPermission: conversation.pinPermission,
  };
}

async function getConversationPins(conversationId, userId) {
  const isMember = await prisma.conversationMember.findUnique({
    where: {
      userId_conversationId: { userId, conversationId },
    },
  });

  if (!isMember) {
    throw createHTTPError(403, "Not a member of conversation");
  }

  const pins = await prisma.conversationPin.findMany({
    where: {
      conversationId,
      message: {
        deletedAt: null,
      },
    },
    orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
    take: 10,
    select: {
      messageId: true,
      conversationId: true,
      pinnedAt: true,
      pinnedBy: {
        select: { id: true, username: true, avatar: true },
      },
      message: {
        select: {
          id: true,
          content: true,
          messageType: true,
          createdAt: true,
          sender: {
            select: { id: true, username: true, avatar: true },
          },
          attachments: {
            take: 1,
            select: {
              id: true,
              url: true,
              mimeType: true,
              originalFileName: true,
            },
          },
        },
      },
    },
  });

  return pins.map((pin) => ({
    ...pin,
    message: {
      ...pin.message,
      previewText: derivePreviewText(pin.message),
    },
  }));
}

async function createGroupConversation(userId, title, memberIds) {
  //validate title
  if (!title || title.trim().length === 0) {
    throw createHTTPError(400, "Title is required for group conversations");
  }

  memberIds = memberIds || [];
  //validate memberIds
  if (!Array.isArray(memberIds)) {
    throw createHTTPError(400, "memberIds must be an array of user IDs");
  }

  const uniqueIds = [...new Set(memberIds)] // remove duplicates
    .map((id) => Number(id)) // convert to numbers
    .filter((id) => Number.isInteger(id) && id !== userId); // filter out invalid IDs and the creator's ID

  if (uniqueIds.length < 2) {
    // at least 2 members besides the creator
    throw createHTTPError(
      400,
      "At least two valid member IDs (excluding the creator) are required to create a group conversation",
    );
  }

  const foundUsers = await prisma.user.findMany({
    // validate that all member IDs exist
    where: { id: { in: uniqueIds } },
  });

  if (foundUsers.length !== uniqueIds.length) {
    // some IDs do not correspond to existing users
    throw createHTTPError(404, "One or more members not found");
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
    throw createHTTPError(404, "Conversation not found");
  }

  if (conversation.type !== "GROUP") {
    // check if conversation is group type
    throw createHTTPError(400, "Cannot add members to a private conversation");
  }

  if (conversation.creatorId !== currentUserId) {
    // check if current user is creator
    throw createHTTPError(403, "Only the conversation creator can add members");
  }

  const newUser = await prisma.user.findUnique({
    // check if new user exists
    where: { id: newUserId },
    select: { id: true, username: true, avatar: true },
  });
  if (!newUser) {
    throw createHTTPError(404, "User to be added not found");
  }

  //check if new user is already a member
  const isAlreadyMember = conversation.members.some((member) => member.userId === newUserId);
  if (isAlreadyMember) {
    throw createHTTPError(409, "User is already a member of the conversation");
  }

  await prisma.conversationMember.create({
    // add new member
    data: {
      conversationId,
      userId: newUserId,
    },
  });

  //fetch new conversation
  const updatedConversation = await getConversationDetails(conversationId, currentUserId);

  return {
    conversationId,
    member: newUser,
    conversation: updatedConversation,
  };
}

async function leaveGroup(conversationId, userId) {
  const membership = await prisma.conversationMember.findUnique({
    // get membership record include conversation type for validation
    where: { userId_conversationId: { userId, conversationId } },
    include: {
      conversation: { select: { type: true } },
      user: { select: { id: true, username: true, avatar: true } },
    },
  });

  if (!membership) {
    // check if user is a member of the conversation
    throw createHTTPError(404, "Not a member of this conversation");
  }
  if (membership.conversation.type !== "GROUP") {
    // check if conversation is group type
    throw createHTTPError(400, "Cannot leave a private conversation");
  }
  await prisma.conversationMember.delete({
    // remove membership record
    where: { userId_conversationId: { userId, conversationId } },
  });

  return {
    user: membership.user,
  };
}

async function removeMember(conversationId, currentUserId, targetUserId) {
  if (targetUserId === currentUserId) {
    throw createHTTPError(400, "You cannot remove yourself");
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId: targetUserId, conversationId } },
    include: {
      conversation: { select: { type: true, creatorId: true } },
      user: { select: { id: true, username: true, avatar: true } },
    },
  });

  let conversationMeta = membership?.conversation;
  if (!conversationMeta) {
    conversationMeta = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, creatorId: true },
    });
    if (!conversationMeta) throw createHTTPError(404, "Conversation not found");
  }

  if (conversationMeta.type !== "GROUP") {
    throw createHTTPError(400, "Cannot remove members from a private conversation");
  }
  if (conversationMeta.creatorId !== currentUserId) {
    throw createHTTPError(403, "Only the group creator can remove members");
  }
  if (!membership) {
    throw createHTTPError(404, "User is not a member");
  }

  await prisma.conversationMember.delete({
    where: { userId_conversationId: { userId: targetUserId, conversationId } },
  });

  return membership.user;
}

async function findOrCreatePrivateConversation(userId, recipientId) {
  // function for lazy connection (1-on-1 chat)
  //validate if not self
  if (userId === recipientId) {
    throw createHTTPError(400, "Cannot create private conversation with yourself");
  }
  // check if recipient exists
  const recipient = await prisma.user.findUnique({
    // query recipient user
    where: { id: recipientId }, // find by id
    select: { id: true, username: true, avatar: true },
  });
  if (!recipient) {
    throw createHTTPError(404, "Recipient user not found");
  }
  //query all memberships of userId
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: true, // include members to check for recipient
        },
      },
    },
  });
  // filter
  const existingConversation = memberships.find(({ conversation }) => {
    // look for existing private conversation
    return (
      conversation.type === "PRIVATE" && // must be private
      conversation.members.length === 2 && // must have exactly 2 members
      conversation.members.some((member) => member.userId === recipientId)
    ); // must include recipient
  });
  if (existingConversation) {
    // if found existing conversation
    return existingConversation.conversation.id; // return existing conversation ID
  }
  //transaction to create new private conversation
  const conversationId = await prisma.$transaction(async (tx) => {
    // create new conversation
    const newConversation = await tx.conversation.create({
      data: { type: "PRIVATE", creatorId: userId, title: null }, // private type, no title
    });
    // create conversation member
    await tx.conversationMember.createMany({
      data: [
        { userId, conversationId: newConversation.id }, // add current user
        { userId: recipientId, conversationId: newConversation.id }, // add recipient user
      ],
    });
    return newConversation.id;
  });
  return conversationId;
}

export {
  derivePreviewText,
  serializeLatestPinnedMessage,
  buildPinSummary,
  getConversations,
  getConversationDetails,
  getConversationPins,
  createGroupConversation,
  addMemberToGroup,
  leaveGroup,
  removeMember,
  findOrCreatePrivateConversation,
};
