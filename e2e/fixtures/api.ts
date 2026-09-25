import { SERVER_URL } from "../env";

/** A tiny REST client for tests: like curl with a bearer token. */
export function apiClient(token?: string) {
  return async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${SERVER_URL}/api/v1${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
}
