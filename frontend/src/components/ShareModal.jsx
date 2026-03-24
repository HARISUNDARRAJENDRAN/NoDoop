import React, { useCallback, useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";
import {
  getCollaborators,
  inviteUser,
  removeCollaborator,
  transferOwnership,
  updateCollaboratorRole
} from "../lib/api.js";

export default function ShareModal({ docId, onClose, currentRole }) {
  const { token, user } = useAuth();
  const [collabs, setCollabs] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchCollabs = useCallback(async () => {
    if (!token || !docId) return;
    try {
      const data = await getCollaborators(token, docId);
      setCollabs(data);
    } catch {
      // silent
    }
  }, [token, docId]);

  useEffect(() => {
    fetchCollabs();
  }, [fetchCollabs]);

  async function handleInvite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const invited = await inviteUser(token, docId, email.trim(), role);
      setCollabs((prev) => {
        const exists = prev.find((c) => c.userId === invited.userId);
        if (exists) return prev.map((c) => (c.userId === invited.userId ? invited : c));
        return [...prev, invited];
      });
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId) {
    setUpdatingUserId(userId);
    setError("");
    setNotice("");
    try {
      await removeCollaborator(token, docId, userId);
      setCollabs((prev) => prev.filter((c) => c.userId !== userId));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleRoleChange(userId, nextRole) {
    setUpdatingUserId(userId);
    setError("");
    setNotice("");
    try {
      const updated = await updateCollaboratorRole(token, docId, userId, nextRole);
      setCollabs((prev) =>
        prev.map((c) =>
          c.userId === userId ? { ...c, role: updated.role } : c
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleTransferOwnership(target) {
    if (!confirm(`Transfer ownership to ${target.name || target.email}? You will become an editor.`)) {
      return;
    }

    setUpdatingUserId(target.userId);
    setError("");
    setNotice("");
    try {
      await transferOwnership(token, docId, target.userId);
      setCollabs((prev) =>
        prev.map((c) => {
          if (c.userId === target.userId) return { ...c, role: "owner" };
          if (c.userId === user?.id) return { ...c, role: "editor" };
          return c;
        })
      );
      setNotice("Ownership transferred. Re-open this panel to refresh your capabilities.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  const isOwner = currentRole === "owner";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share document</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        {isOwner && (
          <form className="share-invite-form" onSubmit={handleInvite}>
            <input
              type="email"
              placeholder="Add people by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Invite
            </button>
          </form>
        )}

        <div className="share-collab-list">
          <h4>People with access</h4>
          {collabs.map((c) => (
            <div key={c.userId} className="share-collab-row">
              <div className="share-collab-info">
                <span className="share-collab-name">{c.name || c.email}</span>
                <span className="share-collab-email">{c.email}</span>
              </div>
              {isOwner && c.role !== "owner" ? (
                <select
                  className="share-role-select"
                  value={c.role}
                  onChange={(e) => handleRoleChange(c.userId, e.target.value)}
                  disabled={updatingUserId === c.userId}
                  title="Change role"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className={`role-badge role-${c.role}`}>{c.role}</span>
              )}
              {isOwner && c.role !== "owner" && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleTransferOwnership(c)}
                  title="Transfer ownership"
                  disabled={updatingUserId === c.userId}
                >
                  Make owner
                </button>
              )}
              {isOwner && c.role !== "owner" && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRemove(c.userId)}
                  title="Remove access"
                  disabled={updatingUserId === c.userId}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
