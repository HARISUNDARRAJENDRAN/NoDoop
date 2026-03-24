import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      if (mode === "register") {
        await register(form);
        setNotice("Account created! Please sign in.");
        setMode("login");
      } else {
        await login({ email: form.email, password: form.password });
        navigate("/");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#1a73e8" />
            <text x="6" y="20" fontSize="16" fontWeight="bold" fill="#fff">N</text>
          </svg>
          <h1>NoDoop Docs</h1>
          <p className="auth-subtitle">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-label">
            Email
            <input
              type="email"
              value={form.email}
              onChange={update("email")}
              required
              autoFocus
            />
          </label>

          {mode === "register" && (
            <label className="form-label">
              Name
              <input
                type="text"
                value={form.name}
                onChange={update("name")}
                required
              />
            </label>
          )}

          <label className="form-label">
            Password
            <input
              type="password"
              value={form.password}
              onChange={update("password")}
              required
              minLength={8}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-toggle">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button className="link-btn" onClick={() => { setMode("register"); setError(""); }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="link-btn" onClick={() => { setMode("login"); setError(""); }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
