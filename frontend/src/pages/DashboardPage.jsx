import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createDoc,
  deleteDoc,
  listDocs,
  renameDoc,
  updateDocPreferences
} from "../lib/api.js";

const TEMPLATES = [
  { title: "Blank document", content: "" },
  { title: "Meeting notes", content: "Meeting Notes\n\nDate:\nAttendees:\n\nAgenda\n1.\n2.\n\nAction Items\n-" },
  { title: "Project proposal", content: "Project Proposal\n\nObjective\n\nScope\n\nTimeline\n\nBudget\n\nTeam" },
  { title: "Weekly report", content: "Weekly Report\n\nWeek of:\n\nAccomplishments\n-\n\nPlanned\n-\n\nBlockers\n-" },
  { title: "Resume", content: "Your Name\nyour@email.com\n\nExperience\n\nEducation\n\nSkills" }
];

export default function DashboardPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [filter, setFilter] = useState("recent");
  const [updatingPrefId, setUpdatingPrefId] = useState(null);
  const renameRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    try {
      const items = await listDocs(token, search);
      setDocs(items);
    } catch (err) {
      console.error("Failed to fetch docs", err);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(fetchDocs, 300);
    return () => clearTimeout(timer);
  }, [fetchDocs]);

  async function handleCreate(template) {
    setCreating(true);
    try {
      const doc = await createDoc(token, template.title === "Blank document" ? "Untitled document" : template.title);
      navigate(`/docs/${doc.id}`);
    } catch (err) {
      console.error("Create failed", err);
    } finally {
      setCreating(false);
    }
  }

  function openDoc(id) {
    navigate(`/docs/${id}`);
  }

  async function handleDelete(e, docId) {
    e.stopPropagation();
    if (!confirm("Delete this document? This cannot be undone.")) return;
    try {
      await deleteDoc(token, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  async function handleToggle(docId, key, nextValue) {
    setUpdatingPrefId(docId);
    try {
      const updated = await updateDocPreferences(token, docId, { [key]: nextValue });
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
              ...d,
              starred: updated.starred,
              pinned: updated.pinned
            }
            : d
        )
      );
    } catch (err) {
      console.error("Preference update failed", err);
    } finally {
      setUpdatingPrefId(null);
    }
  }

  function startRename(e, doc) {
    e.stopPropagation();
    setRenamingId(doc.id);
    setRenameTitle(doc.title);
    setTimeout(() => renameRef.current?.focus(), 50);
  }

  async function submitRename(docId) {
    if (!renameTitle.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameDoc(token, docId, renameTitle.trim());
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, title: renameTitle.trim() } : d
        )
      );
    } catch {
      // silent
    }
    setRenamingId(null);
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const filteredDocs = docs.filter((doc) => {
    if (filter === "starred") return Boolean(doc.starred);
    if (filter === "pinned") return Boolean(doc.pinned);
    return true;
  });

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-hero">
        <h2>Start a new document</h2>
        <div className="template-gallery">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              className="template-card"
              onClick={() => handleCreate(t)}
              disabled={creating}
            >
              <div className="template-preview">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
              </div>
              <span className="template-label">{t.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-content">
        <div className="docs-header">
          <h3>Recent documents</h3>
          <div className="docs-search-row">
            <div className="docs-filter-tabs">
              <button
                className={`filter-tab${filter === "recent" ? " active" : ""}`}
                onClick={() => setFilter("recent")}
              >
                Recent
              </button>
              <button
                className={`filter-tab${filter === "starred" ? " active" : ""}`}
                onClick={() => setFilter("starred")}
              >
                Starred
              </button>
              <button
                className={`filter-tab${filter === "pinned" ? " active" : ""}`}
                onClick={() => setFilter("pinned")}
              >
                Pinned
              </button>
            </div>
            <div className="search-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={fetchDocs}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="docs-empty">Loading...</p>
        ) : filteredDocs.length === 0 ? (
          <p className="docs-empty">
            {search
              ? "No documents match your search."
              : filter === "starred"
                ? "No starred documents yet."
                : filter === "pinned"
                  ? "No pinned documents yet."
                  : "No documents yet. Create one above to get started."}
          </p>
        ) : (
          <table className="docs-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Role</th>
                <th>Last modified</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr
                  key={doc.id}
                  className="docs-row"
                  onClick={() => openDoc(doc.id)}
                >
                  <td className="docs-title-cell">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    {renamingId === doc.id ? (
                      <input
                        ref={renameRef}
                        className="rename-input"
                        value={renameTitle}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        onBlur={() => submitRename(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(doc.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                    ) : (
                      doc.title
                    )}
                  </td>
                  <td>
                    <span className={`role-badge role-${doc.role}`}>{doc.role}</span>
                  </td>
                  <td>{formatDate(doc.updatedAt)}</td>
                  <td className="docs-actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggle(doc.id, "starred", !doc.starred)}
                      title={doc.starred ? "Unstar" : "Star"}
                      disabled={updatingPrefId === doc.id}
                    >
                      {doc.starred ? "Unstar" : "Star"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggle(doc.id, "pinned", !doc.pinned)}
                      title={doc.pinned ? "Unpin" : "Pin"}
                      disabled={updatingPrefId === doc.id}
                    >
                      {doc.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => startRename(e, doc)}
                      title="Rename"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    {doc.role === "owner" && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => handleDelete(e, doc.id)}
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red-700)" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
