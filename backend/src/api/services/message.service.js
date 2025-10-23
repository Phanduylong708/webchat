import { prisma } from "../../shared/prisma.js";
import { createHTTPError } from "../../shared/utils/error.util.js";

async function getMessages(conversationId, userId, before, limit) {
  const isMember = await prisma.conversationMember.findUnique({
    // Check if user is a member of the conversation
    where: {
      userId_conversationId: { userId, conversationId },
    },
  });
  if (!isMember) {
    // If not a member, throw an error
    throw createHTTPError(403, "Not a member of conversation");
  }

  const where = { conversationId }; // Prepare query conditions
  if (before) {
    // If 'before' cursor is provided, add it to the conditions
    where.id = { lt: before }; // Fetch messages with IDs less than 'before'
  }
  const messages = await prisma.message.findMany({
    // Fetch messages from the database
    where,
    orderBy: { id: "desc" }, // Order messages by ID in descending order
    take: limit + 1, // Fetch one extra message to determine if there are more messages
    include: { sender: { select: { id: true, username: true, avatar: true } } }, // Include sender details
  });

  const hasMore = messages.length > limit; // Check if there are more messages to fetch
  let nextCursor = null; //if there are more messages, set the next cursor
  if (hasMore) {
    messages.pop(); // Remove the extra message used for pagination check
    nextCursor = messages[messages.length - 1].id; // Set the next cursor to the ID of the last message
  }
  messages.reverse(); // Reverse messages to have them in ascending order
  return {
    messages,
    meta: {
      // Return messages along with pagination metadata
      limit,
      hasMore,
      nextCursor,
    },
  };
}

export { getMessages };
