import * as Y from "yjs";

import { DocVersion } from "../models/DocVersion.js";
import { Document } from "../models/Document.js";
import { getBlob } from "./dfs-client.js";
import { persistDocumentVersion } from "./doc-storage.js";

const rooms = new Map();

export function getOrCreateRoom(docId) {
  if (!rooms.has(docId)) {
    rooms.set(docId, {
      ydoc: new Y.Doc(),
      loaded: false,
      dirty: false,
      lastEditorId: null,
      latestVersionId: null,
      clients: new Set()
    });
  }
  return rooms.get(docId);
}

export function getRoomIfExists(docId) {
  return rooms.get(docId) || null;
}

export async function loadRoomState(docId, room) {
  if (room.loaded) return;

  const doc = await Document.findById(docId).lean();
  if (!doc) {
    room.loaded = true;
    return;
  }

  room.latestVersionId = doc.latestVersionId;

  if (!doc.latestVersionId) {
    room.loaded = true;
    return;
  }

  const version = await DocVersion.findOne({
    docId,
    versionId: doc.latestVersionId
  }).lean();

  if (!version) {
    room.loaded = true;
    return;
  }

  const payload = await getBlob(version.dfsKey);
  Y.applyUpdate(room.ydoc, payload);
  room.loaded = true;
}

export function applyUpdate(room, update, editorId) {
  Y.applyUpdate(room.ydoc, update);
  room.dirty = true;
  room.lastEditorId = editorId;
}

export function encodeRoomState(room) {
  return Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
}

export async function flushAllDirtyRooms() {
  for (const [docId, room] of rooms.entries()) {
    if (!room.dirty || !room.lastEditorId) continue;

    const payload = encodeRoomState(room);

    const version = await persistDocumentVersion({
      docId,
      authorId: room.lastEditorId,
      payload,
      parentVersionId: room.latestVersionId
    });

    room.latestVersionId = version.versionId;
    room.dirty = false;
  }
}

export function destroyRoom(docId) {
  const room = rooms.get(docId);
  if (room) {
    room.ydoc.destroy();
    rooms.delete(docId);
  }
}

export function activeRoomCount() {
  return rooms.size;
}
