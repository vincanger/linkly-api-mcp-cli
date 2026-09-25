import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SERVER_URL } from "../env";

/** Connects the real MCP SDK client over Streamable HTTP with a static bearer token. */
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
