import React from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#1a73e8" />
          <text x="6" y="20" fontSize="16" fontWeight="bold" fill="#fff">N</text>
        </svg>
        <span>NoDoop Docs</span>
      </Link>

      <div className="navbar-right">
        <span className="navbar-user">{user?.name || user?.email}</span>
        <button className="btn btn-sm btn-ghost" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
