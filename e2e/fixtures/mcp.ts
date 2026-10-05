import { Client as ModernClient, StreamableHTTPClientTransport as ModernTransport, type ElicitResult } from "@modelcontextprotocol/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SERVER_URL } from "../env";

/**
 * Connects the MCP SDK v1 client over Streamable HTTP with a static bearer
 * token. It speaks 2025-11-25, so these tests also check that clients that
 * haven't moved to 2026-07-28 keep working.
 */
export async function connectMcp(token: string, query = "") {
  const transport = new StreamableHTTPClientTransport(new URL(`${SERVER_URL}/mcp${query}`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: "linkly-e2e", version: "1.0.0" });
  await client.connect(transport);
  return {
    client,
    call: (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args }),
    toolNames: async () => (await client.listTools()).tools.map((t) => t.name).sort(),
    close: () => client.close(),
  };
}

export const textOf = (result: { content?: unknown }) => ((result.content as { text?: string }[] | undefined)?.[0]?.text ?? "");

/**
 * A 2026-07-28 client (MCP SDK v2) that can open URLs, like a client with
 * URL-mode elicitation. `openUrl` plays the user's browser and returns what
 * the user chose in the client's "open this page?" prompt.
 */
export async function connectMcpWithUrlElicitation(token: string, openUrl: (url: string) => Promise<ElicitResult["action"]>) {
  const client = new ModernClient(
    { name: "linkly-e2e-modern", version: "1.0.0" },
    { capabilities: { elicitation: { url: {} } }, versionNegotiation: { mode: "auto" } },
  );
  client.setRequestHandler("elicitation/create", async (request) => {
    const params = request.params as { mode?: string; url?: string };
    if (params.mode !== "url" || !params.url) return { action: "decline" };
    return { action: await openUrl(params.url) };
  });
  await client.connect(new ModernTransport(new URL(`${SERVER_URL}/mcp`), { authProvider: { token: async () => token } }));
  return {
    client,
    call: (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args }),
    close: () => client.close(),
  };
}
