// Every CLI command and the MCP tool it mirrors. Tests use this to check
// CLI ⇄ MCP parity and that destructive commands require --yes.
export type CommandInfo = { command: string; tool: string | null; destructive: boolean };

export const COMMANDS: CommandInfo[] = [
  { command: "whoami", tool: "whoami", destructive: false },
  { command: "links list", tool: "list_links", destructive: false },
  { command: "links get", tool: "get_link", destructive: false },
  { command: "links create", tool: "create_link", destructive: false },
  { command: "links update", tool: "update_link", destructive: false },
  { command: "links delete", tool: "delete_link", destructive: true },
  { command: "stats", tool: "get_link_stats", destructive: false },
  { command: "top-links", tool: "get_top_links", destructive: false },
  { command: "docs search", tool: "search_docs", destructive: false },
  { command: "docs read", tool: "read_doc", destructive: false },
  { command: "auth login", tool: null, destructive: false },
  { command: "auth logout", tool: null, destructive: false },
];
