import { describe, expect, it } from "vitest";
import { principalFromGrant } from "../shared/principal";
import { prisma } from "../test/db";
import { allTools, parseToolsetsParam, toolsFor } from "./registry";

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
