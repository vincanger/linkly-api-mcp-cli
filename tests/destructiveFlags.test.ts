// Every surface says what's destructive, and they agree: OpenAPI
// `x-destructive`, MCP `destructiveHint`, and the CLI's --yes requirement.
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../cli/src/manifest";
import { buildProgram } from "../cli/src/program";
import { allTools } from "../src/mcp/registry";
import { prisma } from "../src/test/db";
import { buildOpenApiDocument } from "../src/openapi/document";

const OPERATION_TO_TOOL: Record<string, string> = {
  whoami: "whoami",
  listLinks: "list_links",
  createLink: "create_link",
  getLink: "get_link",
  updateLink: "update_link",
  deleteLink: "delete_link",
  getLinkStats: "get_link_stats",
  getTopLinks: "get_top_links",
  searchDocs: "search_docs",
  readDoc: "read_doc",
};

describe("destructive flags agree across surfaces", () => {
  const tools = new Map(allTools({ prisma }).map((t) => [t.name, t]));
  const ops = Object.values(buildOpenApiDocument().paths ?? {}).flatMap((item) =>
    Object.values(item as Record<string, { operationId?: string; "x-destructive"?: boolean }>),
  );

  it("maps every OpenAPI operation to an MCP tool", () => {
    expect(ops.map((o) => o.operationId).sort()).toEqual(Object.keys(OPERATION_TO_TOOL).sort());
  });

  it("OpenAPI x-destructive matches the tool's destructiveHint", () => {
    for (const op of ops) {
      const tool = tools.get(OPERATION_TO_TOOL[op.operationId!]!)!;
      expect(op["x-destructive"], op.operationId).toBe(tool.annotations.destructiveHint ?? false);
    }
  });

  it("CLI commands for destructive tools are marked destructive and require --yes", () => {
    const io = { stdout: () => {}, stderr: () => {}, isTTY: false };
    const program = buildProgram(io, async () => "");
    for (const c of COMMANDS) {
      const destructive = c.tool ? (tools.get(c.tool)?.annotations.destructiveHint ?? false) : false;
      expect(c.destructive, c.command).toBe(destructive);
      if (!destructive) continue;
      const [group, name] = c.command.split(" ");
      const cmd = program.commands.find((x) => x.name() === group)!.commands.find((x) => x.name() === name)!;
      expect(cmd.options.map((o) => o.long), c.command).toContain("--yes");
    }
  });
});
