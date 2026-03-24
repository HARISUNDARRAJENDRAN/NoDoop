import React from "react";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const COLORS = [
  "#1a73e8", "#e8710a", "#0d652d", "#a142f4",
  "#c5221f", "#007b83", "#b93815", "#1967d2"
];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function PresenceAvatars({ users }) {
  if (!users || users.length === 0) return null;

  return (
    <div className="presence-avatars">
      {users.map((u, i) => (
        <div
          key={u.id || i}
          className="presence-avatar"
          style={{ backgroundColor: colorFor(u.name || u.email) }}
          title={u.name || u.email}
        >
          {getInitials(u.name || u.email)}
        </div>
      ))}
    </div>
  );
}
