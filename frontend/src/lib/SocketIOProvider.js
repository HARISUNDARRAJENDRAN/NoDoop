import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness.js";

function base64ToBytes(v) {
  return Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}

export class SocketIOProvider {
  constructor(socket, docId, ydoc, { initialBase64 = null } = {}) {
    this.socket = socket;
    this.docId = docId;
    this.doc = ydoc;
    this.awareness = new Awareness(ydoc);
    this._synced = false;
    this._presenceListeners = [];

    if (initialBase64) {
      Y.applyUpdate(this.doc, base64ToBytes(initialBase64));
      this._synced = true;
    }

    this._onRemoteUpdate = ({ updateBase64, docId: incomingDocId }) => {
      if (incomingDocId !== this.docId) return;
      Y.applyUpdate(this.doc, base64ToBytes(updateBase64));
    };

    this._onLocalUpdate = (update, origin) => {
      if (origin === "remote") return;
      this.socket.emit("doc:update", {
        docId: this.docId,
        updateBase64: bytesToBase64(update)
      });
    };

    this._onPresenceJoin = ({ docId: inDocId, user }) => {
      if (inDocId !== this.docId) return;
      this._notifyPresence("join", user);
    };

    this._onPresenceLeave = ({ docId: inDocId, user }) => {
      if (inDocId !== this.docId) return;
      this._notifyPresence("leave", user);
    };

    this._onRemoteCursor = ({ docId: inDocId, user, cursor }) => {
      if (inDocId !== this.docId) return;
      this._notifyPresence("cursor", { user, cursor });
    };

    this.socket.on("doc:update", this._onRemoteUpdate);
    this.socket.on("doc:presence:join", this._onPresenceJoin);
    this.socket.on("doc:presence:leave", this._onPresenceLeave);
    this.socket.on("doc:cursor", this._onRemoteCursor);
    this.doc.on("update", this._onLocalUpdate);
  }

  get synced() {
    return this._synced;
  }

  onPresence(fn) {
    this._presenceListeners.push(fn);
    return () => {
      this._presenceListeners = this._presenceListeners.filter((l) => l !== fn);
    };
  }

  _notifyPresence(type, data) {
    for (const fn of this._presenceListeners) fn(type, data);
  }

  sendCursor(cursor) {
    this.socket.emit("doc:cursor", { docId: this.docId, cursor });
  }

  destroy() {
    this.socket.off("doc:update", this._onRemoteUpdate);
    this.socket.off("doc:presence:join", this._onPresenceJoin);
    this.socket.off("doc:presence:leave", this._onPresenceLeave);
    this.socket.off("doc:cursor", this._onRemoteCursor);
    this.doc.off("update", this._onLocalUpdate);
    this.awareness.destroy();
    this._presenceListeners = [];
  }
}
