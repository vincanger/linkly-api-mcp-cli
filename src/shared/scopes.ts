// Single source of truth for permissions. The consent screen, token
// validation, MCP registry, and OpenAPI security docs all read from here.

export const SCOPES = {
  "links:read": "View your links",
  "links:write": "Create, edit, and delete your links",
  "analytics:read": "View click analytics",
} as const;
export type Scope = keyof typeof SCOPES;
export const ALL_SCOPES = Object.keys(SCOPES) as Scope[];

export const TOOLSETS = {
  links: { label: "Links", scopes: ["links:read", "links:write"] },
  analytics: { label: "Analytics", scopes: ["analytics:read"] },
} as const satisfies Record<string, { label: string; scopes: readonly Scope[] }>;
export type Toolset = keyof typeof TOOLSETS;
export const ALL_TOOLSETS = Object.keys(TOOLSETS) as Toolset[];

// Always available regardless of toolset selection (no data access):
export const CORE_TOOLS = ["whoami", "search_docs", "read_doc", "get_dashboard_url"] as const;

export function isScope(value: string): value is Scope {
  return value in SCOPES;
}

export function isToolset(value: string): value is Toolset {
  return value in TOOLSETS;
}

/** Keeps only known scopes, in canonical order, without duplicates. */
export function normalizeScopes(values: Iterable<string>): Scope[] {
  const wanted = new Set(values);
  return ALL_SCOPES.filter((s) => wanted.has(s));
}

export function scopesForToolsets(toolsets: Iterable<Toolset>): Scope[] {
  const scopes: Scope[] = [];
  for (const t of toolsets) scopes.push(...TOOLSETS[t].scopes);
  return normalizeScopes(scopes);
}

/** A toolset is granted when every one of its scopes is granted. */
export function toolsetsForScopes(scopes: Iterable<string>): Toolset[] {
  const granted = new Set(scopes);
  return ALL_TOOLSETS.filter((t) => TOOLSETS[t].scopes.every((s) => granted.has(s)));
}
