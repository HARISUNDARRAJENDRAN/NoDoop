import { env } from "../config/env.js";

function encodeKey(key) {
  return encodeURIComponent(key);
}

export async function putBlob(key, bytes) {
  const response = await fetch(`${env.dfsBridgeUrl}/v1/blobs/${encodeKey(key)}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream"
    },
    body: bytes
  });

  if (!response.ok) {
    throw new Error(`dfs put failed: ${response.status}`);
  }

  return response.json();
}

export async function getBlob(key) {
  const response = await fetch(`${env.dfsBridgeUrl}/v1/blobs/${encodeKey(key)}`);
  if (!response.ok) {
    throw new Error(`dfs get failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
