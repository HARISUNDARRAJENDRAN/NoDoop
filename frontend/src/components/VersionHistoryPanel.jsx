import React, { useCallback, useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";
import { getHistory, restoreVersion } from "../lib/api.js";

function formatDate(d) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function VersionHistoryPanel({ docId, onClose, onRestore, canRestore = true }) {
  const { token } = useAuth();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!token || !docId) return;
    try {
      const data = await getHistory(token, docId);
      setVersions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, docId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function handleRestore(versionId) {
    setRestoring(versionId);
    try {
      const result = await restoreVersion(token, docId, versionId);
      if (onRestore) onRestore(result);
      onClose();
    } catch {
      // silent
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Version history</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <p className="history-empty">Loading...</p>
        ) : versions.length === 0 ? (
          <p className="history-empty">No versions saved yet.</p>
        ) : (
          <div className="history-list">
            {versions.map((v, i) => (
              <div key={v.versionId} className="history-item">
                <div className="history-info">
                  <span className="history-label">
                    {i === 0 ? "Current version" : `Version ${versions.length - i}`}
                  </span>
                  <span className="history-meta">
                    {formatDate(v.createdAt)} &middot; {v.authorName} &middot; {formatSize(v.size)}
                  </span>
                  <span className="history-hash">
                    {v.checksum.slice(0, 12)}...
                  </span>
                </div>
                {i !== 0 && canRestore && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRestore(v.versionId)}
                    disabled={restoring === v.versionId}
                  >
                    {restoring === v.versionId ? "Restoring..." : "Restore"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
