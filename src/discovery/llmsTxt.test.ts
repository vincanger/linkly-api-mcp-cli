import { describe, expect, it } from "vitest";
import { DOCS } from "../docs/content";
import { renderLlmsTxt } from "./llmsTxt";

describe("renderLlmsTxt", () => {
  const txt = renderLlmsTxt({ serverUrl: "https://api.linkly.example/" });

  it("starts with the llmstxt.org header", () => {
    expect(txt).toMatch(/^# Linkly\n\n> /);
  });

  it("links the MCP server and the OpenAPI document with absolute URLs", () => {
    expect(txt).toContain("(https://api.linkly.example/mcp)");
    expect(txt).toContain("(https://api.linkly.example/api/v1/openapi.json)");
    expect(txt).not.toContain("example//");
  });

  it("links the token page and every doc with root-relative paths", () => {
    expect(txt).toContain("(/settings/tokens)");
    for (const doc of DOCS) expect(txt).toContain(`(/docs/${doc.slug})`);
  });

  it("has both rules", () => {
    const rules = txt.split("## Rules")[1]!.split("## Docs")[0]!;
    expect(rules).toContain("Never ask the user for their Linkly password");
    expect(rules).toContain("Ask the user before any operation marked `x-destructive: true`");
  });

  it("puts the sections in order", () => {
    const order = ["## MCP (recommended)", "## REST API", "## Rules", "## Docs"].map((h) => txt.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
