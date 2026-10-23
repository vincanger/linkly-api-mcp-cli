// Collects every slice's tools and decides which ones a principal sees.
import type { PrismaClient } from "@prisma/client";
import { accountTools } from "../account/mcp";
import { analyticsTools } from "../analytics/mcp";
import { deeplinkTools } from "../deeplinks/mcp";
import { docsTools } from "../docs/mcp";
import { linksTools } from "../links/mcp";
import type { Principal } from "../shared/principal";
import { isToolset, normalizeScopes, type Scope, type Toolset } from "../shared/scopes";
import type { AnyToolDef } from "./defineTool";

export type RegistryDeps = { prisma: PrismaClient };

export function allTools(deps: RegistryDeps): AnyToolDef[] {
  return [...accountTools(deps), ...docsTools(), ...deeplinkTools(), ...linksTools(deps), ...analyticsTools(deps)];
}

/**
 * OAuth clients can ask the user for more scopes mid-session (step-up), so
 * they see tools they can't call yet. A PAT's scopes are fixed, so tools it
 * can't call stay hidden.
 */
export const canStepUp = (principal: Principal): boolean => principal.source === "oauth";

/**
 * 1. Core tools are always included.
 * 2. Other tools need their scope on the principal, unless it can step up.
 * 3. `?toolsets=` can only narrow the list, never widen it.
 */
export function toolsFor(tools: AnyToolDef[], principal: Principal, requestedToolsets?: Toolset[]): AnyToolDef[] {
  return tools.filter((tool) => {
    if (tool.toolset === "core") return true;
    if (!tool.scope) return false;
    if (!principal.scopes.has(tool.scope) && !canStepUp(principal)) return false;
    if (requestedToolsets && !requestedToolsets.includes(tool.toolset)) return false;
    return true;
  });
}

/**
 * The scopes to ask for when `principal` calls a tool it lacks the scope for,
 * or undefined when it can call it. The real enforcement: the MCP handler
 * answers these with 403 `insufficient_scope` before the tool runs.
 *
 * The challenge carries what the grant already has plus what's missing, so a
 * client that re-authorizes with exactly these scopes keeps its other tools.
 * A write scope brings its read scope, as on the consent screen.
 */
export function stepUpScopes(tool: AnyToolDef, principal: Principal): Scope[] | undefined {
  if (!tool.scope || principal.scopes.has(tool.scope)) return undefined;
  const [resource, access] = tool.scope.split(":");
  const needed = access === "write" ? [tool.scope, `${resource}:read`] : [tool.scope];
  return normalizeScopes([...principal.scopes, ...needed]);
}

/** Parses `?toolsets=links,analytics`. Unknown names are ignored; absent means no filter. */
export function parseToolsetsParam(value: unknown): Toolset[] | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(isToolset);
}
