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

/** The scopes a user picked, limited to a ceiling (what the app asked for). */
export function capScopes(chosen: Iterable<string>, ceiling: Iterable<string>): Scope[] {
  const allowed = new Set(ceiling);
  return normalizeScopes(chosen).filter((s) => allowed.has(s));
}

/**
 * Checkbox logic for every scope picker. Write access can already read
 * (update_link returns the link), so write without read would be a false
 * promise: ticking write ticks read, and unticking read unticks write.
 */
export function toggleScope(selected: readonly Scope[], scope: Scope, checked: boolean): Scope[] {
  const resource = scope.split(":")[0];
  const read = `${resource}:read`;
  const write = `${resource}:write`;
  if (checked) return normalizeScopes([...selected, scope, ...(scope === write ? [read] : [])]);
  return selected.filter((s) => s !== scope && !(scope === read && s === write));
}

/** A toolset is granted when every one of its scopes is granted. */
export function toolsetsForScopes(scopes: Iterable<string>): Toolset[] {
  const granted = new Set(scopes);
  return ALL_TOOLSETS.filter((t) => TOOLSETS[t].scopes.every((s) => granted.has(s)));
}
