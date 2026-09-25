// Cross-package tests (server + CLI) live outside src/, which Wasp compiles on its own.
// Every MCP tool has a CLI command (or says why not), and every CLI command
// in the manifest really exists in the program.
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../cli/src/manifest";
import { buildProgram } from "../cli/src/program";
import { prisma } from "../src/test/db";
import { allTools } from "../src/mcp/registry";

export const TOOL_TO_CLI: Record<string, string> = {
  whoami: "whoami",
  list_links: "links list",
  get_link: "links get",
  create_link: "links create",
  update_link: "links update",
  delete_link: "links delete",
  get_link_stats: "stats",
  get_top_links: "top-links",
  search_docs: "docs search",
  read_doc: "docs read",
  get_dashboard_url: "no-cli: every JSON result already includes dashboardUrl, and human output prints it",
};

function programCommands(): string[] {
  const io = { stdout: () => {}, stderr: () => {}, isTTY: false };
  const program = buildProgram(io, async () => "");
  const paths: string[] = [];
  const walk = (cmd: typeof program, prefix: string) => {
    for (const sub of cmd.commands) {
      const path = prefix ? `${prefix} ${sub.name()}` : sub.name();
      if (sub.commands.length) walk(sub, path);
      else paths.push(path);
    }
  };
  walk(program, "");
  return paths.sort();
}

describe("MCP ⇄ CLI parity", () => {
  const tools = allTools({ prisma }).map((t) => t.name).sort();

  it("maps every MCP tool, and only existing ones", () => {
    expect(Object.keys(TOOL_TO_CLI).sort()).toEqual(tools);
  });

  it("maps to CLI commands that exist, or explains why not", () => {
    const commands = programCommands();
    for (const [tool, command] of Object.entries(TOOL_TO_CLI)) {
      if (command.startsWith("no-cli: ")) continue;
      expect(commands, `${tool} → ${command}`).toContain(command);
      expect(COMMANDS.find((c) => c.command === command)?.tool, command).toBe(tool);
    }
  });

  it("keeps the CLI manifest in sync with the program", () => {
    expect(COMMANDS.map((c) => c.command).sort()).toEqual(programCommands());
  });
});
