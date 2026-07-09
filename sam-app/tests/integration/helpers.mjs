const BASE = process.env.API_ENDPOINT || "http://127.0.0.1:3000";

export async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: res.status, body: await res.json() };
}

export function randomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
