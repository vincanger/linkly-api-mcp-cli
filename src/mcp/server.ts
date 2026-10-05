// Builds an McpServer for one request's principal. Stateless: a fresh server
// per request, so there's no session state to share between instances. One
// handler serves both protocol eras: 2025-era clients (initialize) and
// 2026-07-28 clients (per-request capabilities, multi-round-trip retries).
import type { PrismaClient } from "@prisma/client";
import {
  createMcpHandler,
  isInputRequiredResult,
  McpServer,
  type AuthInfo,
  type CallToolResult,
  type InputRequiredResult,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { toMcpToolError } from "../shared/errors";
import type { Principal } from "../shared/principal";
import type { Toolset } from "../shared/scopes";
import { confirmations, type ConfirmationDeps } from "./confirmations";
import type { AnyToolDef } from "./defineTool";
import { allTools, parseToolsetsParam, toolsFor } from "./registry";
import { allResources, type ResourceDef } from "./resources";

export const SERVER_VERSION = "1.0.0";

export const SERVER_INSTRUCTIONS = [
  "Linkly is a link shortener with click analytics: you can list, create, update, and delete short links, and read how often they're clicked.",
  "Use search_docs when you're unsure how a Linkly concept works (slugs, tags, how clicks are counted, permissions).",
  "Results include a dashboardUrl; use get_dashboard_url or share those URLs when the user wants to see charts or edit something themselves.",
  "Deletions may need the user's confirmation in Linkly. Clients that can open web pages show the confirmation page themselves; otherwise delete_link returns a confirmation link: share it with the user and tell them the link is deleted once they confirm.",
].join(" ");

export type ToolCallLog = { tool: string; userId: string; grantId?: string; durationMs: number; ok: boolean };

type Log = (entry: ToolCallLog) => void;

export function buildServer(opts: {
  principal: Principal;
  tools: AnyToolDef[];
  resources?: ResourceDef[];
  requestedToolsets?: Toolset[];
  prisma: PrismaClient;
  confirmations?: Omit<ConfirmationDeps, "prisma">;
  log?: Log;
}): McpServer {
  const { principal, log = (e) => console.log(JSON.stringify({ mcpTool: e })) } = opts;
  const confirm = confirmations(principal, { prisma: opts.prisma, ...opts.confirmations });
  const server = new McpServer(
    { name: "linkly", title: "Linkly", version: SERVER_VERSION },
    {
      instructions: SERVER_INSTRUCTIONS,
      requestState: { verify: confirm.verify },
      // The shim answers input_required for 2025-era clients by pushing
      // requests over a session, and this server has none. Those clients
      // never get input_required (they get the link), so fail loudly if one does.
      inputRequired: { legacyShim: false },
    },
  );

  for (const tool of toolsFor(opts.tools, principal, opts.requestedToolsets)) {
    const outputSchema = tool.output ? z.object(tool.output) : undefined;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: z.object(tool.input),
        outputSchema,
        annotations: { title: tool.title, ...tool.annotations },
      },
      async (input: Record<string, unknown>, ctx): Promise<CallToolResult | InputRequiredResult> => {
        const started = Date.now();
        let ok = false;
        try {
          // A retry carries requestState: report the outcome, never run the tool again.
          const result = (await confirm.resume(tool.name, ctx)) ?? (await confirm.offer(tool.name, await tool.handler(principal, input as never), ctx));
          ok = true;
          if (isInputRequiredResult(result)) return result;
          const structured = outputSchema ? outputSchema.parse(result) : (result as Record<string, unknown>);
          return {
            structuredContent: structured as Record<string, unknown>,
            content: [{ type: "text", text: JSON.stringify(structured) }],
          };
        } catch (e) {
          ok = false;
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

/** How the bearer middleware hands its principal to the MCP handler (`authInfo.extra`). */
export function authInfoFor(principal: Principal): AuthInfo {
  return { token: "", clientId: principal.clientName ?? principal.source, scopes: [...principal.scopes], extra: { principal } };
}

/**
 * The MCP endpoint as a web-standard handler. Requests must arrive already
 * authenticated, with `authInfoFor(principal)`; `?toolsets=` is read from the URL.
 */
export function linklyMcpHandler(deps: { prisma: PrismaClient; confirmations?: Omit<ConfirmationDeps, "prisma">; log?: Log }) {
  const tools = allTools({ prisma: deps.prisma });
  const resources = allResources();
  return createMcpHandler(
    ({ authInfo, requestInfo }) => {
      const principal = authInfo?.extra?.principal as Principal | undefined;
      if (!principal) throw new Error("MCP requests must be authenticated before they reach the handler.");
      const toolsets = requestInfo ? new URL(requestInfo.url).searchParams.get("toolsets") : null;
      return buildServer({ ...deps, principal, tools, resources, requestedToolsets: parseToolsetsParam(toolsets ?? undefined) });
    },
  );
}
