import { prisma } from "../../shared/prisma.js";
import { getFriends } from "../../api/services/friend.service.js";
import { joinUserConversations } from "../helpers/helpers.js";

async function handleStatus(io, socket) {
  const user = socket.data.user;
  const userRoom = `user_${user.id}`;
  const friends = await getFriends(user.id);
  socket.join(userRoom);
  await joinUserConversations(io, socket, user.id); // Join conversation rooms

  const room = io.sockets.adapter.rooms.get(userRoom);
  const isFirstConnection = room && room.size === 1; // Check if this is the first connection for the user

  if (isFirstConnection) {
    await prisma.user.update({
      // Mark user as online
      where: { id: user.id },
      data: { isOnline: true },
    });

    friends.forEach((friend) => {
      // Notify friends that user is online
      const friendRoom = `user_${friend.id}`;
      io.to(friendRoom).emit("friendOnline", {
        userId: user.id,
        username: user.username,
      }); // Notify all tabs, devices of the friend
    });
  }
  console.log(`User connected: ${user.id}`);
  socket.on("disconnect", async () => {
    const room = io.sockets.adapter.rooms.get(userRoom); // Get the room for the user
    if (!room) {
      // If no more connections for this user
      await prisma.user.update({
        // Mark user as offline
        where: { id: user.id },
        data: { isOnline: false, lastSeen: new Date() },
      });

      friends.forEach((friend) => {
        // Notify friends that user is offline
        const friendRoom = `user_${friend.id}`;
        io.to(friendRoom).emit("friendOffline", {
          userId: user.id,
          lastSeen: new Date(),
        }); // Notify all tabs, devices of the friend
      });
    }
    console.log(`User disconnected: ${user.id}`);
  });
}

export { handleStatus };
