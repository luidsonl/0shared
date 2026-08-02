import { ApiError } from "./types";

declare global {
  interface Window {
    __ENV__?: { API_BASE?: string };
  }
}

const API_BASE = window.__ENV__?.API_BASE ?? "";

const TOKEN_KEY = "0shared.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiFetchOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  redirect?: "follow" | "manual";
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", token, body, redirect } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      // body was not JSON; keep the generic message
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
