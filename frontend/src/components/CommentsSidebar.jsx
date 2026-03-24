import React, { useCallback, useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";
import {
  createComment,
  getComments,
  replyToComment,
  resolveComment
} from "../lib/api.js";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function CommentItem({ comment, docId, onUpdate, canEdit }) {
  const { token } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      const updated = await replyToComment(token, docId, comment._id, replyText.trim());
      onUpdate(updated);
      setReplyText("");
      setShowReply(false);
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve() {
    try {
      const updated = await resolveComment(token, docId, comment._id);
      onUpdate(updated);
    } catch {
      // silent
    }
  }

  return (
    <div className={`comment-item${comment.resolved ? " resolved" : ""}`}>
      <div className="comment-header">
        <span className="comment-author">{comment.authorName || "User"}</span>
        <span className="comment-time">{timeAgo(comment.createdAt)}</span>
      </div>
      <p className="comment-body">{comment.content}</p>

      {comment.replies?.map((r, i) => (
        <div key={i} className="comment-reply">
          <span className="comment-author">{r.authorName || "User"}</span>
          <span className="comment-time">{timeAgo(r.createdAt)}</span>
          <p className="comment-body">{r.content}</p>
        </div>
      ))}

      <div className="comment-actions">
        {!comment.resolved && canEdit && (
          <button className="link-btn" onClick={() => setShowReply(!showReply)}>
            Reply
          </button>
        )}
        {!comment.resolved && canEdit && (
          <button className="link-btn" onClick={handleResolve}>
            Resolve
          </button>
        )}
        {comment.resolved && <span className="comment-resolved-badge">Resolved</span>}
      </div>

      {showReply && canEdit && (
        <form className="comment-reply-form" onSubmit={handleReply}>
          <input
            type="text"
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

export default function CommentsSidebar({ docId, socket, canEdit = true }) {
  const { token } = useAuth();
  const [comments, setComments] = useState([]);
  const [newText, setNewText] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!token || !docId) return;
    try {
      const data = await getComments(token, docId);
      setComments(data);
    } catch {
      // silent
    }
  }, [token, docId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (!socket) return;

    const onCreate = ({ comment }) => {
      setComments((prev) => [comment, ...prev]);
    };
    const onReply = ({ comment }) => {
      setComments((prev) =>
        prev.map((c) => (c._id === comment._id ? comment : c))
      );
    };
    const onResolve = ({ commentId }) => {
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, resolved: true } : c))
      );
    };

    socket.on("doc:comment:create", onCreate);
    socket.on("doc:comment:reply", onReply);
    socket.on("doc:comment:resolve", onResolve);

    return () => {
      socket.off("doc:comment:create", onCreate);
      socket.off("doc:comment:reply", onReply);
      socket.off("doc:comment:resolve", onResolve);
    };
  }, [socket]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!canEdit) return;
    if (!newText.trim()) return;
    setBusy(true);
    try {
      const comment = await createComment(token, docId, newText.trim());
      setComments((prev) => [comment, ...prev]);
      setNewText("");

      if (socket) {
        socket.emit("doc:comment:create", { docId, comment });
      }
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  }

  function handleUpdate(updated) {
    setComments((prev) =>
      prev.map((c) => (c._id === updated._id ? updated : c))
    );
  }

  return (
    <aside className="comments-sidebar">
      <h3 className="comments-title">Comments</h3>

      <form className="comments-new" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Add a comment..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          disabled={!canEdit}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !canEdit}>
          Post
        </button>
      </form>

      <div className="comments-list">
        {comments.length === 0 && (
          <p className="comments-empty">No comments yet</p>
        )}
        {comments.map((c) => (
            <CommentItem
              key={c._id}
              comment={c}
              docId={docId}
              onUpdate={handleUpdate}
              canEdit={canEdit}
            />
          ))}
      </div>
    </aside>
  );
}
