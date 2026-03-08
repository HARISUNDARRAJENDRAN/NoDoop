const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
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

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function register(payload) {
  return request("/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function createDoc(token, title) {
  return request("/docs", {
    token,
    method: "POST",
    body: JSON.stringify({ title })
  });
}

export function listDocs(token) {
  return request("/docs", { token });
}

export function saveDoc(token, docId, payloadBase64, parentVersionId = null) {
  return request(`/docs/${docId}/save`, {
    token,
    method: "POST",
    body: JSON.stringify({ payloadBase64, parentVersionId })
  });
}
