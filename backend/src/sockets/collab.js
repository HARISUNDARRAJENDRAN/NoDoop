import { Server } from "socket.io";
import mongoose from "mongoose";
import * as Y from "yjs";

import { env } from "../config/env.js";
import { DocVersion } from "../models/DocVersion.js";
import { Document } from "../models/Document.js";
import { Permission } from "../models/Permission.js";
import { getBlob } from "../services/dfs-client.js";
import { persistDocumentVersion } from "../services/doc-storage.js";
import { verifyAccessToken } from "../services/tokens.js";

const docRooms = new Map();

function getOrCreateRoomState(docId) {
  if (!docRooms.has(docId)) {
    docRooms.set(docId, {
      ydoc: new Y.Doc(),
      loaded: false,
      dirty: false,
      lastEditorId: null,
      latestVersionId: null
    });
  }
  return docRooms.get(docId);
}

async function loadDocumentState(docId, state) {
  if (state.loaded) {
    return;
  }

  const doc = await Document.findById(docId).lean();
  if (!doc) {
    state.loaded = true;
    return;
  }

  state.latestVersionId = doc.latestVersionId;

  if (!doc.latestVersionId) {
    state.loaded = true;
    return;
  }

  const version = await DocVersion.findOne({ docId, versionId: doc.latestVersionId }).lean();
  if (!version) {
    state.loaded = true;
    return;
  }

  const payload = await getBlob(version.dfsKey);
  Y.applyUpdate(state.ydoc, payload);
  state.loaded = true;
}

async function flushDirtyRooms() {
  const entries = Array.from(docRooms.entries());

  for (const [docId, state] of entries) {
    if (!state.dirty || !state.lastEditorId) {
      continue;
    }

    const payload = Buffer.from(Y.encodeStateAsUpdate(state.ydoc));

    const version = await persistDocumentVersion({
      docId,
      authorId: state.lastEditorId,
      payload,
      parentVersionId: state.latestVersionId
    });

    state.latestVersionId = version.versionId;
    state.dirty = false;
  }
}

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
      if (!token) {
        throw new Error("missing token");
      }

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

        const permission = await Permission.findOne({ docId, userId: socket.data.user.id }).lean();
        if (!permission) {
          throw new Error("forbidden");
        }

        const state = getOrCreateRoomState(docId);
        await loadDocumentState(docId, state);

        socket.join(docId);

        const initial = Buffer.from(Y.encodeStateAsUpdate(state.ydoc)).toString("base64");
        ack({ ok: true, initialUpdateBase64: initial, role: permission.role });
      } catch (error) {
        ack({ ok: false, error: error.message });
      }
    });

    socket.on("doc:update", async ({ docId, updateBase64 }) => {
      try {
        if (!mongoose.isValidObjectId(docId)) {
          return;
        }

        const state = getOrCreateRoomState(docId);
        const permission = await Permission.findOne({ docId, userId: socket.data.user.id }).lean();
        if (!permission || (permission.role !== "owner" && permission.role !== "editor")) {
          return;
        }

        const update = Buffer.from(updateBase64, "base64");
        Y.applyUpdate(state.ydoc, update);

        state.dirty = true;
        state.lastEditorId = socket.data.user.id;

        socket.to(docId).emit("doc:update", { docId, updateBase64 });
      } catch (error) {
        console.error("doc:update error", error);
      }
    });
  });

  setInterval(() => {
    flushDirtyRooms().catch((error) => {
      console.error("flush error", error);
    });
  }, 5000);

  return io;
}
