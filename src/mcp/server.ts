// Builds an McpServer for one request's principal. Stateless: a fresh server
// per request, so there's no session state to share between instances.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { toMcpToolError } from "../shared/errors";
import type { Principal } from "../shared/principal";
import type { Toolset } from "../shared/scopes";
import type { AnyToolDef } from "./defineTool";
import { toolsFor } from "./registry";
import type { ResourceDef } from "./resources";

export const SERVER_VERSION = "1.0.0";

export const SERVER_INSTRUCTIONS = [
  "Linkly is a link shortener with click analytics: you can list, create, update, and delete short links, and read how often they're clicked.",
  "Use search_docs when you're unsure how a Linkly concept works (slugs, tags, how clicks are counted, permissions).",
  "Results include a dashboardUrl; use get_dashboard_url or share those URLs when the user wants to see charts or edit something themselves.",
  "Deletions may return a confirmation link instead of deleting: share it with the user and tell them the link is deleted once they confirm.",
].join(" ");

export type ToolCallLog = { tool: string; userId: string; grantId?: string; durationMs: number; ok: boolean };

export function buildServer(opts: {
  principal: Principal;
  tools: AnyToolDef[];
  resources?: ResourceDef[];
  requestedToolsets?: Toolset[];
  log?: (entry: ToolCallLog) => void;
}): McpServer {
  const { principal, log = (e) => console.log(JSON.stringify({ mcpTool: e })) } = opts;
  const server = new McpServer(
    { name: "linkly", title: "Linkly", version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  for (const tool of toolsFor(opts.tools, principal, opts.requestedToolsets)) {
    const outputSchema = tool.output ? z.object(tool.output) : undefined;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: tool.output,
        annotations: { title: tool.title, ...tool.annotations },
      },
      async (input: Record<string, unknown>): Promise<CallToolResult> => {
        const started = Date.now();
        let ok = false;
        try {
          const result = await tool.handler(principal, input as never);
          const structured = outputSchema ? outputSchema.parse(result) : (result as Record<string, unknown>);
          ok = true;
          return {
            structuredContent: structured as Record<string, unknown>,
            content: [{ type: "text", text: JSON.stringify(structured) }],
          };
        } catch (e) {
          return toMcpToolError(e);
        } finally {
          log({ tool: tool.name, userId: principal.userId, grantId: principal.grantId, durationMs: Date.now() - started, ok });
        }
      },
    );
  }

  for (const resource of opts.resources ?? []) {
    server.registerResource(
      resource.name,
      resource.uri,
      { title: resource.title, description: resource.description, mimeType: resource.mimeType },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: resource.mimeType, text: await resource.read() }] }),
    );
  }
  return server;
}
