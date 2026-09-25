// POST /mcp: stateless Streamable HTTP. Each request gets a fresh server and
// transport built for its principal; both are closed when the response ends.
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { prisma } from "wasp/server";
import type { Mcp } from "wasp/server/api";
import { byMethod, withBearer } from "../shared/http";
import { allTools, parseToolsetsParam } from "./registry";
import { allResources } from "./resources";
import { buildServer } from "./server";

const methodNotAllowed = (res: Parameters<Mcp>[1]) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: this server is stateless, use POST." }, id: null });
};

export const mcp: Mcp = byMethod({
  POST: withBearer("mcp", async (req, res, principal) => {
    const server = buildServer({
      principal,
      tools: allTools({ prisma }),
      resources: allResources(),
      requestedToolsets: parseToolsetsParam(req.query.toolsets),
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }),
  // No sessions to resume or delete in stateless mode.
  GET: (_req, res) => methodNotAllowed(res),
  DELETE: (_req, res) => methodNotAllowed(res),
});
