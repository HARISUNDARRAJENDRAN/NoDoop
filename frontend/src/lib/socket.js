import { io } from "socket.io-client";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

let socket = null;

export function getSocket(token) {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(API_URL, {
    transports: ["websocket"],
    auth: { token }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
