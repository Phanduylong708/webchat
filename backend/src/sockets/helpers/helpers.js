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

export { joinUserConversations };
