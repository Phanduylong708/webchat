import { prisma } from "../../shared/prisma.js";

async function joinUserConversations(io, socket, userId) {
  // use for status and add member
  const memberships = await prisma.conversationMember.findMany({
    // get all conversation IDs the user is part of
    where: { userId: userId },
    select: { conversationId: true },
  });

  memberships.forEach(({ conversationId }) => {
    // join each conversation socket room
    socket.join(`conversation_${conversationId}`);
  });
}

async function verifyMembership(userId, conversationId) {
  const membership = await prisma.conversationMember.findUnique({
    where: {
      userId_conversationId: { userId, conversationId },
    },
  });
  return membership !== null;
}

function getUserRoom(userId) {
  // centralized function for user room naming
  return `user_${userId}`;
}

function getConversationRoom(conversationId) {
  return `conversation_${conversationId}`;
}

function getCallRoom(callId) {
  // dedicated room for an active call session
  return `call_${callId}`;
}

async function getConversationMemberIds(conversationId) {
  // Get all user IDs in a conversation
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function getConversationType(conversationId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true },
  });
  return conversation?.type || null;
}

// Filters user IDs to only include those currently online (have active socket connections)
function getOnlineUserIds(io, userIds) {
  const onlineUserIds = [];
  for (const userId of userIds) {
    const targetUserRoom = getUserRoom(userId);
    const targetUserRoomObject = io.sockets.adapter.rooms.get(targetUserRoom);
    if (targetUserRoomObject && targetUserRoomObject.size > 0) {
      onlineUserIds.push(userId);
    }
  }
  return onlineUserIds;
}

export {
  joinUserConversations,
  verifyMembership,
  getUserRoom,
  getConversationRoom,
  getCallRoom,
  getConversationMemberIds,
  getConversationType,
  getOnlineUserIds,
};
