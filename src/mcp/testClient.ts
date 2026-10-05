// Test helper: an MCP SDK client driving the real handler in-process (no
// port), as a request authenticated for `principal`. It speaks 2026-07-28 by
// default; `era: "legacy"` connects the 2025 way (initialize).
import { Client, StreamableHTTPClientTransport, type ClientCapabilities, type ElicitRequest, type ElicitResult } from "@modelcontextprotocol/client";
import type { Principal } from "../shared/principal";
import type { Toolset } from "../shared/scopes";
import { prisma } from "../test/db";
import type { ConfirmationDeps } from "./confirmations";
import { authInfoFor, linklyMcpHandler } from "./server";

export type ConnectOptions = {
  toolsets?: Toolset[];
  era?: "modern" | "legacy";
  capabilities?: ClientCapabilities;
  /** Answers elicitation requests, like a real client's UI would. */
  onElicit?: (params: ElicitRequest["params"]) => ElicitResult | Promise<ElicitResult>;
  confirmations?: Omit<ConfirmationDeps, "prisma">;
};

export async function connectInProcess(principal: Principal, opts: ConnectOptions = {}) {
  const handler = linklyMcpHandler({ prisma, confirmations: opts.confirmations, log: () => {} });
  const query = opts.toolsets ? `?toolsets=${opts.toolsets.join(",")}` : "";
  const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:3001/mcp${query}`), {
    fetch: (url, init) => handler.fetch(new Request(url, init), { authInfo: authInfoFor(principal) }),
  });
  const client = new Client(
    { name: "test", version: "1.0.0" },
    { capabilities: opts.capabilities ?? {}, versionNegotiation: { mode: opts.era === "legacy" ? "legacy" : "auto" } },
  );
  // The SDK only lets a client that declares elicitation answer it.
  if (opts.onElicit && opts.capabilities?.elicitation) client.setRequestHandler("elicitation/create", (request) => opts.onElicit!(request.params));
  await client.connect(transport);
  return {
    client,
    call(name: string, args: Record<string, unknown> = {}) {
      return client.callTool({ name, arguments: args });
    },
    async close() {
      await client.close();
      await handler.close();
    },
  };
}
