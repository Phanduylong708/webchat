import { prisma } from "../../shared/prisma.js";

async function addFriend(currentUserId, friendId) {
  try {
    if (currentUserId === friendId) {
      const error = new Error("You cannot add yourself as a friend");
      error.statusCode = 400;
      throw error;
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
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
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
      const error = new Error("You are already friends with this user");
      error.statusCode = 409;
      throw error;
    }
    await prisma.friendship.create({
      data: { userId1: userId1, userId2: userId2 },
    });
    return existingUser;
  } catch (error) {
    throw error;
  }
}

async function getFriends(currentUserId) {
  try {
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
  } catch (error) {
    throw error;
  }
}

async function removeFriend(currentUserId, friendId) {
  try {
    const userId1 = Math.min(currentUserId, friendId);
    const userId2 = Math.max(currentUserId, friendId);
    const existingFriendShip = await prisma.friendship.findFirst({
      where: {
        userId1: userId1,
        userId2: userId2,
      },
    });
    if (!existingFriendShip) {
      const error = new Error("You are not friends with this user");
      error.statusCode = 404;
      throw error;
    }
    await prisma.friendship.delete({
      where: { id: existingFriendShip.id },
    });
    return true;
  } catch (error) {
    throw error;
  }
}

export { addFriend, getFriends, removeFriend };
