import { api, type Spec } from "@wasp.sh/spec";
import { mcp } from "./handler" with { type: "ref" };

// Bearer auth (PATs and OAuth tokens) happens in the handler, so Wasp's session auth is off.
export const mcpSpec: Spec = [api("ALL", "/mcp", mcp, { auth: false })];
