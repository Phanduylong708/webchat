import { io, Socket } from "socket.io-client";

const baseURL = import.meta.env.VITE_API_BASE_URL as string;

let socketInstance: Socket | null = null; //singleton socket instance

//factory function to create a socket connection
function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(baseURL, {
      autoConnect: false, //socket provider will connect manually
    });
  }
  return socketInstance;
}

function initializeSocket(token: string): void { // token come from provider
  if (socketInstance) {
    socketInstance.auth = { token };
    socketInstance.connect();
    return;
  }
  const socket = getSocket();
  socket.auth = { token };
  socket.connect();

}

function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null; // new connection when login/logout
  }
}

export { getSocket, initializeSocket, disconnectSocket };