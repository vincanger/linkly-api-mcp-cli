// The executable form of "the MCP server can do everything the dashboard can".
// Every Wasp operation maps to the MCP tool that covers it, or says why it's
// dashboard-only. Adding an operation or a tool without updating this map fails.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "../test/db";
import { allTools } from "./registry";

export const OPERATION_COVERAGE: Record<string, string> = {
  // links
  getLinks: "list_links",
  getLink: "get_link",
  createLink: "create_link",
  updateLink: "update_link",
  deleteLink: "delete_link",
  // analytics
  getLinkStats: "get_link_stats",
  getTopLinks: "get_top_links",
  // tokens
  getPats: "dashboard-only: personal access tokens are managed by the human in a session; tokens can't mint or list tokens",
  createPat: "dashboard-only: personal access tokens are managed by the human in a session; tokens can't mint or list tokens",
  revokePat: "dashboard-only: personal access tokens are managed by the human in a session; tokens can't mint or list tokens",
  // oauth consent + connected apps
  getAuthorizeRequest: "dashboard-only: consent has to come from the human, not from the app asking for access",
  approveAuthorization: "dashboard-only: consent has to come from the human, not from the app asking for access",
  denyAuthorization: "dashboard-only: consent has to come from the human, not from the app asking for access",
  getGrants: "dashboard-only: an app can't inspect or change its own permissions (whoami shows them)",
  updateGrant: "dashboard-only: an app can't inspect or change its own permissions (whoami shows them)",
  revokeGrant: "dashboard-only: an app can't inspect or change its own permissions (whoami shows them)",
};

/** Tools with no dashboard operation, and why. */
export const MCP_ONLY_TOOLS: Record<string, string> = {
  whoami: "agents need to self-orient; the dashboard shows the logged-in user in the header",
};

function waspOperationNames(): string[] {
  const names: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".wasp.ts")) {
        for (const m of readFileSync(path, "utf8").matchAll(/\b(?:query|action)\((\w+)/g)) names.push(m[1]!);
      }
    }
  };
  walk(join(process.cwd(), "src"));
  return names.sort();
}

describe("dashboard ⇄ MCP parity", () => {
  const tools = allTools({ prisma }).map((t) => t.name);

  it("maps every Wasp operation, and only existing ones", () => {
    expect(waspOperationNames()).toEqual(Object.keys(OPERATION_COVERAGE).sort());
  });

  it("maps operations to tools that exist, or explains why not", () => {
    for (const [op, coverage] of Object.entries(OPERATION_COVERAGE)) {
      if (coverage.startsWith("dashboard-only: ")) expect(coverage.length, op).toBeGreaterThan("dashboard-only: ".length + 10);
      else expect(tools, `${op} → ${coverage}`).toContain(coverage);
    }
  });

  it("accounts for every tool", () => {
    const covered = new Set([...Object.values(OPERATION_COVERAGE), ...Object.keys(MCP_ONLY_TOOLS)]);
    for (const tool of tools) expect(covered.has(tool), `tool ${tool} isn't in the parity map`).toBe(true);
    for (const tool of Object.keys(MCP_ONLY_TOOLS)) expect(tools).toContain(tool);
  });
});
