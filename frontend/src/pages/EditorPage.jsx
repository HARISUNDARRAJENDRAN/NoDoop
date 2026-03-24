import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as Y from "yjs";

import CommentsSidebar from "../components/CommentsSidebar.jsx";
import Editor from "../components/Editor.jsx";
import PresenceAvatars from "../components/PresenceAvatars.jsx";
import ShareModal from "../components/ShareModal.jsx";
import VersionHistoryPanel from "../components/VersionHistoryPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { saveDoc } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { SocketIOProvider } from "../lib/SocketIOProvider.js";

function bytesToBase64(bytes) {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}

export default function EditorPage() {
  const { id: docId } = useParams();
  const { token, user } = useAuth();

  const [status, setStatus] = useState("Connecting...");
  const [role, setRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const socketRef = useRef(null);
  const parentVersionRef = useRef(null);
  const autosaveRef = useRef(null);

  const cleanup = useCallback(() => {
    if (autosaveRef.current) clearInterval(autosaveRef.current);
    if (providerRef.current) providerRef.current.destroy();
    if (ydocRef.current) ydocRef.current.destroy();
    providerRef.current = null;
    ydocRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!token || !docId) return;

    cleanup();

    const socket = getSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => setStatus("Connected"));
    socket.on("disconnect", () => setStatus("Disconnected"));

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    socket.emit("doc:join", { docId }, (result) => {
      if (!result?.ok) {
        setError(result?.error || "Failed to join document");
        return;
      }

      setRole(result.role);

      const provider = new SocketIOProvider(socket, docId, ydoc, {
        initialBase64: result.initialUpdateBase64
      });
      providerRef.current = provider;

      if (user) {
        provider.awareness.setLocalStateField("user", {
          name: user.name || user.email,
          color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
        });
      }

      const unsub = provider.onPresence((type, data) => {
        if (type === "join") {
          setCollaborators((prev) => {
            if (prev.find((u) => u.id === data.id)) return prev;
            return [...prev, data];
          });
        } else if (type === "leave") {
          setCollaborators((prev) => prev.filter((u) => u.id !== data.id));
        }
      });

      providerRef.current._unsubPresence = unsub;
      parentVersionRef.current = null;
      setStatus("Connected");
      setReady(true);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      setCollaborators([]);
      cleanup();
    };
  }, [token, docId, user, cleanup]);

  useEffect(() => {
    if (!ready || role === "viewer") return;

    autosaveRef.current = setInterval(async () => {
      if (!ydocRef.current || !token) return;
      try {
        const payload = Y.encodeStateAsUpdate(ydocRef.current);
        const saved = await saveDoc(
          token,
          docId,
          bytesToBase64(payload),
          parentVersionRef.current
        );
        parentVersionRef.current = saved.versionId;
      } catch {
        // autosave failures are silent
      }
    }, 30000);

    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [ready, role, token, docId]);

  async function handleSave() {
    if (!token || !docId || !ydocRef.current) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = Y.encodeStateAsUpdate(ydocRef.current);
      const saved = await saveDoc(
        token,
        docId,
        bytesToBase64(payload),
        parentVersionRef.current
      );
      parentVersionRef.current = saved.versionId;
      setNotice(`Saved (v${saved.versionId.slice(0, 8)}...)`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isReadOnly = role === "viewer";

  return (
    <div className="editor-layout">
      <header className="editor-navbar">
        <div className="editor-navbar-left">
          <Link to="/" className="back-btn" title="Back to documents">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </Link>
          <div className="editor-doc-info">
            <span className="editor-doc-title">Document</span>
            <span className="editor-status">
              {status}
              {role && <span className={`role-badge role-${role} ml-8`}>{role}</span>}
            </span>
          </div>
        </div>
        <div className="editor-navbar-right">
          <PresenceAvatars users={collaborators} />
          {notice && <span className="editor-notice">{notice}</span>}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowShare(true)}
            title="Share"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowComments(!showComments)}
            title="Toggle comments"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHistory(true)}
            title="Version history"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
            </svg>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || isReadOnly}
          >
            {saving ? "Saving..." : "Save version"}
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error" style={{ margin: "0 16px" }}>{error}</div>}

      <div className="editor-body">
        <main className="editor-area">
          {ready && ydocRef.current ? (
            <Editor
              ydoc={ydocRef.current}
              provider={providerRef.current}
              readOnly={isReadOnly}
            />
          ) : (
            <div className="editor-loading">Loading document...</div>
          )}
        </main>

        {showComments && (
          <CommentsSidebar
            docId={docId}
            socket={socketRef.current}
            canEdit={role !== "viewer"}
          />
        )}
      </div>

      {showShare && (
        <ShareModal
          docId={docId}
          onClose={() => setShowShare(false)}
          currentRole={role}
        />
      )}

      {showHistory && (
        <VersionHistoryPanel
          docId={docId}
          canRestore={role !== "viewer"}
          onClose={() => setShowHistory(false)}
          onRestore={() => window.location.reload()}
        />
      )}
    </div>
  );
}
