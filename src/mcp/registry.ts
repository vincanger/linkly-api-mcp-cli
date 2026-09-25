// Collects every slice's tools and decides which ones a principal sees.
import type { PrismaClient } from "@prisma/client";
import { accountTools } from "../account/mcp";
import { analyticsTools } from "../analytics/mcp";
import { linksTools } from "../links/mcp";
import type { Principal } from "../shared/principal";
import { isToolset, type Toolset } from "../shared/scopes";
import type { AnyToolDef } from "./defineTool";

export type RegistryDeps = { prisma: PrismaClient };

export function allTools(deps: RegistryDeps): AnyToolDef[] {
  return [...accountTools(deps), ...linksTools(deps), ...analyticsTools(deps)];
}

/**
 * 1. Core tools are always included.
 * 2. Other tools need their scope on the principal (the real enforcement).
 * 3. `?toolsets=` can only narrow the list, never widen it.
 */
export function toolsFor(tools: AnyToolDef[], principal: Principal, requestedToolsets?: Toolset[]): AnyToolDef[] {
  return tools.filter((tool) => {
    if (tool.toolset === "core") return true;
    if (!tool.scope || !principal.scopes.has(tool.scope)) return false;
    if (requestedToolsets && !requestedToolsets.includes(tool.toolset)) return false;
    return true;
  });
}

/** Parses `?toolsets=links,analytics`. Unknown names are ignored; absent means no filter. */
export function parseToolsetsParam(value: unknown): Toolset[] | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(isToolset);
}
