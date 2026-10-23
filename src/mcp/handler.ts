// POST /mcp: stateless Streamable HTTP for both protocol eras. Each request
// gets a fresh server built for its principal, so any instance can answer any
// request, including a 2026-07-28 retry.
import { prisma } from "wasp/server";
import type { Mcp } from "wasp/server/api";
import { byMethod, withBearer } from "../shared/http";
import { serverUrl } from "../shared/urls";
import { sendWebResponse, toWebRequest } from "./nodeBridge";
import { authInfoFor, linklyMcpHandler } from "./server";

const handler = linklyMcpHandler({ prisma });

const methodNotAllowed = (res: Parameters<Mcp>[1]) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: this server is stateless, use POST." }, id: null });
};

export const mcp: Mcp = byMethod({
  POST: withBearer("mcp", async (req, res, principal) => {
    const response = await handler.fetch(toWebRequest(req, res, serverUrl()), { authInfo: authInfoFor(principal), parsedBody: req.body });
    await sendWebResponse(res, response);
  }),
  // No sessions to resume or delete in stateless mode.
  GET: (_req, res) => methodNotAllowed(res),
  DELETE: (_req, res) => methodNotAllowed(res),
});
