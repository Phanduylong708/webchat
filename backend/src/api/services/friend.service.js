import { prisma } from "../../shared/prisma.js";
import { createHTTPError } from "../../shared/utils/error.util.js";

async function addFriend(currentUserId, friendId) {
  if (currentUserId === friendId) {
    throw createHTTPError(400, "You cannot add yourself as a friend");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      id: friendId,
    },
    select: {
      id: true,
      username: true,
      avatar: true,
      isOnline: true,
      lastSeen: true,
    },
  });
  if (!existingUser) {
    throw createHTTPError(404, "User not found");
  }
  const userId1 = Math.min(currentUserId, friendId);
  const userId2 = Math.max(currentUserId, friendId);
  const existingFriendShip = await prisma.friendship.findFirst({
    where: {
      userId1: userId1,
      userId2: userId2,
    },
  });
  if (existingFriendShip) {
    throw createHTTPError(409, "You are already friends with this user");
  }
  await prisma.friendship.create({
    data: { userId1: userId1, userId2: userId2 },
  });
  return existingUser;
}

async function getFriends(currentUserId) {
  const friendship = await prisma.friendship.findMany({
    where: {
      OR: [{ userId1: currentUserId }, { userId2: currentUserId }],
    },
    include: {
      user1: {
        select: {
          id: true,
          username: true,
          avatar: true,
          isOnline: true,
          lastSeen: true,
        },
      },
      user2: {
        select: {
          id: true,
          username: true,
          avatar: true,
          isOnline: true,
          lastSeen: true,
        },
      },
    },
  });
  const friends = friendship.map((friend) => {
    return friend.userId1 === currentUserId ? friend.user2 : friend.user1;
  });
  return friends;
}

async function removeFriend(currentUserId, friendId) {
  const userId1 = Math.min(currentUserId, friendId);
  const userId2 = Math.max(currentUserId, friendId);
  const existingFriendShip = await prisma.friendship.findFirst({
    where: {
      userId1: userId1,
      userId2: userId2,
    },
  });
  if (!existingFriendShip) {
    throw createHTTPError(404, "You are not friends with this user");
  }
  await prisma.friendship.delete({
    where: { id: existingFriendShip.id },
  });
  return true;
}

export { addFriend, getFriends, removeFriend };
