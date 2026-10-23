import { describe, expect, it } from "vitest";
import { principalFromGrant, principalFromPat } from "../shared/principal";
import { prisma } from "../test/db";
import { allTools, parseToolsetsParam, stepUpScopes, toolsFor } from "./registry";

describe("parseToolsetsParam", () => {
  it("parses a comma list and ignores unknown names", () => {
    expect(parseToolsetsParam("links,analytics")).toEqual(["links", "analytics"]);
    expect(parseToolsetsParam(" analytics , admin ")).toEqual(["analytics"]);
    expect(parseToolsetsParam("")).toBeUndefined();
    expect(parseToolsetsParam(undefined)).toBeUndefined();
    expect(parseToolsetsParam(["links"])).toBeUndefined();
  });

  it("filters to nothing but core tools for an unknown-only list", () => {
    const p = principalFromGrant({ id: "g", userId: "u", clientName: "c", scopes: ["links:read", "links:write", "analytics:read"], confirmDestructive: true });
    const names = toolsFor(allTools({ prisma }), p, parseToolsetsParam("bogus")).map((t) => t.name).sort();
    expect(names).toEqual(["get_dashboard_url", "read_doc", "search_docs", "whoami"]);
  });
});

describe("step-up", () => {
  const tools = allTools({ prisma });
  const tool = (name: string) => tools.find((t) => t.name === name)!;
  const grant = (scopes: string[]) => principalFromGrant({ id: "g", userId: "u", clientName: "c", scopes: scopes as never, confirmDestructive: true });

  it("lists every tool for OAuth grants, but only allowed ones for PATs", () => {
    expect(toolsFor(tools, grant(["analytics:read"])).map((t) => t.name)).toContain("create_link");
    expect(toolsFor(tools, principalFromPat({ userId: "u", scopes: ["analytics:read"] })).map((t) => t.name)).not.toContain("create_link");
  });

  it("asks for what the grant has plus what the tool needs", () => {
    expect(stepUpScopes(tool("list_links"), grant(["links:read"]))).toBeUndefined();
    expect(stepUpScopes(tool("whoami"), grant([]))).toBeUndefined();
    expect(stepUpScopes(tool("get_top_links"), grant(["links:read"]))).toEqual(["links:read", "analytics:read"]);
    // Write brings read, like the consent screen.
    expect(stepUpScopes(tool("create_link"), grant(["analytics:read"]))).toEqual(["links:read", "links:write", "analytics:read"]);
  });
});
