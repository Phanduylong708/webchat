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
export {
  joinUserConversations,
  verifyMembership,
  getUserRoom,
  getConversationRoom,
  getCallRoom,
};
