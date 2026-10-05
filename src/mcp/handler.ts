// POST /mcp: stateless Streamable HTTP for both protocol eras. Each request
// gets a fresh server built for its principal, so any instance can answer any
// request, including a 2026-07-28 retry.
import type { Request, Response } from "express";
import { prisma } from "wasp/server";
import type { Mcp } from "wasp/server/api";
import { byMethod, withBearer } from "../shared/http";
import { serverUrl } from "../shared/urls";
import { authInfoFor, linklyMcpHandler } from "./server";

const handler = linklyMcpHandler({ prisma });

const methodNotAllowed = (res: Parameters<Mcp>[1]) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: this server is stateless, use POST." }, id: null });
};

/** Express → web Request. The body is already parsed, so it's passed separately. */
function toWebRequest(req: Request): globalThis.Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return new globalThis.Request(`${serverUrl()}${req.originalUrl}`, { method: req.method, headers });
}

/** Web Response → Express, buffered: Linkly's tools send no mid-call notifications, so there's nothing to stream. */
async function sendWebResponse(res: Response, response: globalThis.Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.send(Buffer.from(await response.arrayBuffer()));
}

export const mcp: Mcp = byMethod({
  POST: withBearer("mcp", async (req, res, principal) => {
    const response = await handler.fetch(toWebRequest(req), { authInfo: authInfoFor(principal), parsedBody: req.body });
    await sendWebResponse(res, response);
  }),
  // No sessions to resume or delete in stateless mode.
  GET: (_req, res) => methodNotAllowed(res),
  DELETE: (_req, res) => methodNotAllowed(res),
});
