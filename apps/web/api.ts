import { readSetting } from "./storage-compat";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const authHeaders = (): Record<string, string> =>
  readSetting(sessionStorage, "token")
    ? { Authorization: `Bearer ${readSetting(sessionStorage, "token")}` }
    : {};
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(authHeaders()))
    headers.set(key, value);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, error.error);
  }
  return response.json();
}

/**
 * Trade the workspace token for a session cookie (HttpOnly, 90 days), so this
 * browser is not asked again. The token itself is not kept in the page.
 */
export async function startSession(token: string): Promise<void> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "" }));
    throw new ApiError(
      response.status,
      response.status === 401
        ? "That token is not correct."
        : error.error || response.statusText,
    );
  }
  sessionStorage.removeItem("lotion-token");
}

/** A tab that still holds a token from before sessions gets a cookie once. */
export async function upgradeLegacyToken(): Promise<void> {
  const token = sessionStorage.getItem("lotion-token");
  if (!token) return;
  await startSession(token).catch(() => undefined);
}

export async function endSession(): Promise<void> {
  await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
  sessionStorage.removeItem("lotion-token");
}
