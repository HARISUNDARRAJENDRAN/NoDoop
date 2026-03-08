import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function createSocket(token) {
  return io(API_URL, {
    transports: ["websocket"],
    auth: { token }
  });
}
