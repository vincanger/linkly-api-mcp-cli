// Express <-> web-standard Request/Response for the MCP handler. Framework-free
// (no Wasp imports) so it can be tested over real HTTP.
import type { Request, Response } from "express";

/**
 * Express → web Request. The body is already parsed, so it's passed separately.
 * The signal aborts when the client goes away, so the SDK closes streams it holds open.
 */
export function toWebRequest(req: Request, res: Response, baseUrl: string): globalThis.Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const aborted = new AbortController();
  res.on("close", () => aborted.abort());
  return new globalThis.Request(`${baseUrl}${req.originalUrl}`, { method: req.method, headers, signal: aborted.signal });
}

/**
 * Web Response → Express, streamed. Buffering breaks 2026-07-28 clients:
 * `subscriptions/listen` is an SSE stream that stays open, so its ack would
 * never arrive, and clients that open it while connecting wait for it to time out.
 */
export async function sendWebResponse(res: Response, response: globalThis.Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  if (!response.body) {
    res.end();
    return;
  }
  res.flushHeaders();
  const reader = response.body.getReader();
  res.on("close", () => void reader.cancel().catch(() => {}));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
  }
}
