import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";

import { createDoc, listDocs, login, register, saveDoc } from "./lib/api.js";
import { createSocket } from "./lib/socket.js";

export default function App() {
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [token, setToken] = useState("");
  const [docs, setDocs] = useState([]);
  const [docTitle, setDocTitle] = useState("Untitled");
  const [activeDocId, setActiveDocId] = useState("");
  const [activeParentVersionId, setActiveParentVersionId] = useState(null);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ydocVersion, setYdocVersion] = useState(0);

  const ydocRef = useRef(new Y.Doc());
  const ytextRef = useRef(ydocRef.current.getText("content"));
  const socketRef = useRef(null);
  const observerRef = useRef(null);

  const isAuthed = useMemo(() => Boolean(token), [token]);
  const statusLabel = isAuthed ? status : "Not authenticated";

  useEffect(() => {
    const observer = () => setContent(ytextRef.current.toString());
    observerRef.current = observer;
    ytextRef.current.observe(observer);

    return () => {
      ytextRef.current.unobserve(observer);
    };
  }, [ydocVersion]);

  function bytesToBase64(bytes) {
    let out = "";
    for (const item of bytes) {
      out += String.fromCharCode(item);
    }
    return btoa(out);
  }

  function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  }

  function resetYDoc() {
    if (observerRef.current) {
      ytextRef.current.unobserve(observerRef.current);
    }
    ydocRef.current.destroy();
    ydocRef.current = new Y.Doc();
    ytextRef.current = ydocRef.current.getText("content");
    setYdocVersion((value) => value + 1);
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = createSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => setStatus("Connected"));
    socket.on("disconnect", () => setStatus("Disconnected"));
    socket.on("doc:update", ({ updateBase64 }) => {
      const update = base64ToBytes(updateBase64);
      Y.applyUpdate(ydocRef.current, update);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  async function refreshDocs() {
    if (!token) {
      return;
    }
    const items = await listDocs(token);
    setDocs(items);
  }

  async function onRegister() {
    try {
      setError("");
      setNotice("");
      setBusy(true);
      await register(form);
      alert("Registration successful. Please login.");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLogin() {
    try {
      setError("");
      setNotice("");
      setBusy(true);
      const data = await login({ email: form.email, password: form.password });
      setToken(data.accessToken);
      await refreshDocs();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateDoc() {
    try {
      setError("");
      setNotice("");
      setBusy(true);
      const created = await createDoc(token, docTitle);
      await refreshDocs();
      await joinDoc(String(created.id), created.latestVersionId ?? null);
    } catch (err) {
      setError(err.message || "Create document failed");
    } finally {
      setBusy(false);
    }
  }

  async function joinDoc(docId, latestVersionId = null) {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    try {
      setError("");
      await new Promise((resolve, reject) => {
        socket.emit("doc:join", { docId }, (result) => {
          if (!result?.ok) {
            reject(new Error(result?.error || "join failed"));
            return;
          }

          resetYDoc();

          const update = base64ToBytes(result.initialUpdateBase64);
          Y.applyUpdate(ydocRef.current, update);
          setContent(ytextRef.current.toString());
          setActiveDocId(docId);
          setActiveParentVersionId(latestVersionId);
          resolve();
        });
      });
    } catch (err) {
      setError(err.message || "Join document failed");
    }
  }

  async function onSaveToDFS() {
    if (!token || !activeDocId) {
      setError("Join a document before saving");
      return;
    }

    try {
      setError("");
      setNotice("");
      setBusy(true);

      const payload = Y.encodeStateAsUpdate(ydocRef.current);
      const payloadBase64 = bytesToBase64(payload);

      const saved = await saveDoc(token, activeDocId, payloadBase64, activeParentVersionId);
      setActiveParentVersionId(saved.versionId);
      setNotice(`Saved to DFS (version ${saved.versionId.slice(0, 8)}...)`);
      await refreshDocs();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function onTextChange(next) {
    if (!activeDocId || !socketRef.current) {
      return;
    }

    ydocRef.current.transact(() => {
      const ytext = ytextRef.current;
      ytext.delete(0, ytext.length);
      ytext.insert(0, next);
    });

    const update = Y.encodeStateAsUpdate(ydocRef.current);
    const updateBase64 = bytesToBase64(update);

    socketRef.current.emit("doc:update", { docId: activeDocId, updateBase64 });
    setContent(next);
  }

  return (
    <main className="app">
      <h1>NoDoop Collaborative Docs</h1>
      <p className="meta">Status: {statusLabel}</p>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      {!isAuthed ? (
        <section className="card">
          <h2>Authentication</h2>
          <div className="row">
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
            />
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
            />
          </div>
          <div className="row">
            <button onClick={onRegister} disabled={busy}>Register</button>
            <button className="secondary" onClick={onLogin} disabled={busy}>
              Login
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Documents</h2>
            <div className="row">
              <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
              <button onClick={onCreateDoc} disabled={busy}>Create</button>
              <button className="secondary" onClick={refreshDocs} disabled={busy}>
                Refresh
              </button>
            </div>
            <div className="row">
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  className={activeDocId === String(doc.id) ? "" : "secondary"}
                  onClick={() => joinDoc(String(doc.id), doc.latestVersionId ?? null)}
                >
                  {doc.title}
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Editor</h2>
            <p className="meta">Active doc: {activeDocId || "none"}</p>
            <div className="row">
              <button onClick={onSaveToDFS} disabled={busy || !activeDocId}>
                Save to DFS
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Join a document to start collaborating"
            />
          </section>
        </>
      )}
    </main>
  );
}
