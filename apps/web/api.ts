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
