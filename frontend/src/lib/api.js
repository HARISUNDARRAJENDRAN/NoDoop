const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15000;

async function request(path, { token, ...options } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("request timed out - check backend availability");
    }
    throw new Error("network error - check backend URL and CORS");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "request failed" }));
    throw new Error(body.error || `request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function register(payload) {
  return request("/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function refreshToken(token) {
  return request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: token })
  });
}

export function createDoc(token, title) {
  return request("/docs", { token, method: "POST", body: JSON.stringify({ title }) });
}

export function listDocs(token, search = "") {
  const q = search ? `?q=${encodeURIComponent(search)}` : "";
  return request(`/docs${q}`, { token });
}

export function getDoc(token, docId) {
  return request(`/docs/${docId}`, { token });
}

export function saveDoc(token, docId, payloadBase64, parentVersionId = null) {
  return request(`/docs/${docId}/save`, {
    token,
    method: "POST",
    body: JSON.stringify({ payloadBase64, parentVersionId })
  });
}

export function getVersions(token, docId) {
  return request(`/docs/${docId}/versions`, { token });
}

export function shareDoc(token, docId, userId, role) {
  return request(`/docs/${docId}/share`, {
    token,
    method: "POST",
    body: JSON.stringify({ userId, role })
  });
}

export function getComments(token, docId) {
  return request(`/docs/${docId}/comments`, { token });
}

export function createComment(token, docId, content) {
  return request(`/docs/${docId}/comments`, {
    token,
    method: "POST",
    body: JSON.stringify({ content })
  });
}

export function replyToComment(token, docId, commentId, content) {
  return request(`/docs/${docId}/comments/${commentId}/replies`, {
    token,
    method: "POST",
    body: JSON.stringify({ content })
  });
}

export function resolveComment(token, docId, commentId) {
  return request(`/docs/${docId}/comments/${commentId}/resolve`, {
    token,
    method: "POST"
  });
}

export function getHistory(token, docId) {
  return request(`/docs/${docId}/history`, { token });
}

export function restoreVersion(token, docId, versionId) {
  return request(`/docs/${docId}/restore`, {
    token,
    method: "POST",
    body: JSON.stringify({ versionId })
  });
}

export function renameDoc(token, docId, title) {
  return request(`/docs/${docId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ title })
  });
}

export function deleteDoc(token, docId) {
  return request(`/docs/${docId}`, { token, method: "DELETE" });
}

export function inviteUser(token, docId, email, role) {
  return request(`/docs/${docId}/invite`, {
    token,
    method: "POST",
    body: JSON.stringify({ email, role })
  });
}

export function getCollaborators(token, docId) {
  return request(`/docs/${docId}/collaborators`, { token });
}

export function removeCollaborator(token, docId, userId) {
  return request(`/docs/${docId}/collaborators/${userId}`, {
    token,
    method: "DELETE"
  });
}

export function updateCollaboratorRole(token, docId, userId, role) {
  return request(`/docs/${docId}/collaborators/${userId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export function transferOwnership(token, docId, userId) {
  return request(`/docs/${docId}/transfer-ownership`, {
    token,
    method: "POST",
    body: JSON.stringify({ userId })
  });
}

export function updateDocPreferences(token, docId, preferences) {
  return request(`/docs/${docId}/preferences`, {
    token,
    method: "PATCH",
    body: JSON.stringify(preferences)
  });
}
