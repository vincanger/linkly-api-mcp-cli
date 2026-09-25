// Lint-style checks for tool definitions: agents only know what the
// descriptions tell them, so these are part of the API.
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { prisma } from "../test/db";
import { allTools } from "./registry";

const tools = allTools({ prisma });
const names = tools.map((t) => t.name);

function enumValues(schema: z.ZodType): string[] | null {
  // Unwrap optional/nullable/default wrappers to find an enum.
  let s: unknown = schema;
  for (let i = 0; i < 5; i++) {
    const def = (s as { def?: { type?: string; innerType?: unknown; entries?: Record<string, string> } }).def;
    if (!def) return null;
    if (def.type === "enum" && def.entries) return Object.values(def.entries);
    if (def.innerType) s = def.innerType;
    else return null;
  }
  return null;
}

describe.each(tools.map((t) => [t.name, t] as const))("tool %s", (name, tool) => {
  it("is snake_case verb_noun with a title", () => {
    expect(name).toMatch(/^[a-z]+(_[a-z]+)+$|^whoami$/);
    expect(tool.title.length).toBeGreaterThan(3);
  });

  it("has a description of at least 60 characters", () => {
    expect(tool.description.length).toBeGreaterThanOrEqual(60);
  });

  it("describes every input field and explains enum values", () => {
    for (const [field, schema] of Object.entries(tool.input)) {
      const description = (schema as z.ZodType).description;
      expect(description, `${name}.${field} needs .describe()`).toBeTruthy();
      for (const value of enumValues(schema as z.ZodType) ?? []) {
        expect(description, `${name}.${field} should explain "${value}"`).toContain(value);
      }
    }
  });

  it("has correct annotations", () => {
    const readOnly = /^(get|list|search|read)_|^whoami$/.test(name);
    expect(tool.annotations.readOnlyHint ?? false).toBe(readOnly);
    if (name.startsWith("delete_")) expect(tool.annotations.destructiveHint).toBe(true);
    else expect(tool.annotations.destructiveHint ?? false).toBe(false);
  });

  it("mentions related tools by name", () => {
    const others = names.filter((n) => n !== name);
    if (tool.toolset !== "core" || others.length > 0) {
      expect(others.some((n) => tool.description.includes(n)), `${name} should mention a related tool`).toBe(true);
    }
  });
});
