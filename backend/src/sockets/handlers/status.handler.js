import { prisma } from "../../shared/prisma.js";
import { getFriends } from "../../api/services/friend.service.js";
import { joinUserConversations, getUserRoom } from "../helpers/helpers.js";

async function handleStatus(io, socket) {
  const user = socket.data.user; // get authenticated user from socket data
  const userRoom = getUserRoom(user.id); // room for the user to track multiple connections
  const friends = await getFriends(user.id); // fetch user's friends
  socket.join(userRoom); // join user's personal room
  await joinUserConversations(io, socket, user.id); // Join conversation rooms

  const room = io.sockets.adapter.rooms.get(userRoom); // Get the room for the user
  const isFirstConnection = room && room.size === 1; // Check if this is the first connection for the user

  if (isFirstConnection) {
    // If first connection, user was offline before
    await prisma.user.update({
      // Mark user as online
      where: { id: user.id },
      data: { isOnline: true },
    });

    friends.forEach((friend) => {
      // Notify friends that user is online
      io.to(getUserRoom(friend.id)).emit("friendOnline", {
        // Notify all tabs, devices of the friend
        userId: user.id,
        username: user.username,
      });
    });
  }
  console.log(`User connected: ${user.id}`);

  // Listen for disconnection event
  socket.on("disconnect", async () => {
    // Handle user disconnection
    const room = io.sockets.adapter.rooms.get(userRoom); // Get the room of the user for remaining connections
    if (!room) {
      // If no more connections for this user
      await prisma.user.update({
        // Mark user as offline
        where: { id: user.id },
        data: { isOnline: false, lastSeen: new Date() },
      });

      friends.forEach((friend) => {
        // Notify friends that user is offline
        io.to(getUserRoom(friend.id)).emit("friendOffline", {
          userId: user.id,
          lastSeen: new Date(),
        }); // Notify all tabs, devices of the friend
      });
    }
    console.log(`User disconnected: ${user.id}`);
  });
}

export { handleStatus };
