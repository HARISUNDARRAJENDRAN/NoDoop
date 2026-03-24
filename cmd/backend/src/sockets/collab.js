import { Server } from "socket.io";
import mongoose from "mongoose";

import { env } from "../config/env.js";
import { Permission } from "../models/Permission.js";
import {
  applyUpdate,
  encodeRoomState,
  flushAllDirtyRooms,
  getOrCreateRoom,
  loadRoomState
} from "../services/collab-room.js";
import { verifyAccessToken } from "../services/tokens.js";

export function attachCollaborationSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error("missing token");

      const payload = verifyAccessToken(token);
      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name
      };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("doc:join", async ({ docId }, ack = () => {}) => {
      try {
        if (!mongoose.isValidObjectId(docId)) {
          throw new Error("invalid doc id");
        }

        const permission = await Permission.findOne({
          docId,
          userId: socket.data.user.id
        }).lean();
        if (!permission) throw new Error("forbidden");

        const room = getOrCreateRoom(docId);
        await loadRoomState(docId, room);
        room.clients.add(socket.id);

        socket.join(docId);

        socket.to(docId).emit("doc:presence:join", {
          docId,
          user: socket.data.user
        });

        const initial = encodeRoomState(room).toString("base64");
        ack({ ok: true, initialUpdateBase64: initial, role: permission.role });
      } catch (error) {
        ack({ ok: false, error: error.message });
      }
    });

    socket.on("doc:update", async ({ docId, updateBase64 }) => {
      try {
        if (!mongoose.isValidObjectId(docId)) return;

        const room = getOrCreateRoom(docId);
        const permission = await Permission.findOne({
          docId,
          userId: socket.data.user.id
        }).lean();
        if (
          !permission ||
          (permission.role !== "owner" && permission.role !== "editor")
        )
          return;

        const update = Buffer.from(updateBase64, "base64");
        applyUpdate(room, update, socket.data.user.id);

        socket.to(docId).emit("doc:update", { docId, updateBase64 });
      } catch (error) {
        console.error("doc:update error", error);
      }
    });

    socket.on("doc:awareness", ({ docId, awarenessBase64 }) => {
      if (!docId) return;
      socket.to(docId).emit("doc:awareness", {
        docId,
        clientId: socket.id,
        user: socket.data.user,
        awarenessBase64
      });
    });

    socket.on("doc:cursor", ({ docId, cursor }) => {
      if (!docId) return;
      socket.to(docId).emit("doc:cursor", {
        docId,
        user: socket.data.user,
        cursor
      });
    });

    socket.on("doc:comment:create", ({ docId, comment }) => {
      if (!docId) return;
      socket.to(docId).emit("doc:comment:create", { docId, comment });
    });

    socket.on("doc:comment:reply", ({ docId, comment }) => {
      if (!docId) return;
      socket.to(docId).emit("doc:comment:reply", { docId, comment });
    });

    socket.on("doc:comment:resolve", ({ docId, commentId }) => {
      if (!docId) return;
      socket.to(docId).emit("doc:comment:resolve", { docId, commentId });
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        const room = getOrCreateRoom(roomId);
        room.clients.delete(socket.id);

        socket.to(roomId).emit("doc:presence:leave", {
          docId: roomId,
          user: socket.data.user
        });
      }
    });
  });

  setInterval(() => {
    flushAllDirtyRooms().catch((error) => {
      console.error("flush error", error);
    });
  }, 5000);

  return io;
}
