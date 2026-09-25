// Every slice declares its MCP tools the same way. The registry turns these
// definitions into SDK registrations and filters them per principal.
import type { z } from "zod";
import type { Principal } from "../shared/principal";
import type { Scope, Toolset } from "../shared/scopes";

export type ZodRawShape = Record<string, z.ZodType>;

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type ToolDef<I extends ZodRawShape = ZodRawShape, O extends ZodRawShape = ZodRawShape> = {
  /** snake_case, verb_noun */
  name: string;
  /** Human label */
  title: string;
  toolset: Toolset | "core";
  /** Required unless core */
  scope?: Scope;
  /** What it does, when to use it, what it returns, related tools */
  description: string;
  input: I;
  /** Becomes outputSchema; results are returned as structuredContent too */
  output?: O;
  annotations: ToolAnnotations;
  handler: (principal: Principal, input: z.infer<z.ZodObject<I>>) => Promise<z.infer<z.ZodObject<O>>>;
};

export function defineTool<I extends ZodRawShape, O extends ZodRawShape>(def: ToolDef<I, O>): ToolDef<I, O> {
  if (def.toolset !== "core" && !def.scope) throw new Error(`Tool ${def.name} needs a scope (only core tools can omit it).`);
  return def;
}

// Erases the generic parameters so tools with different shapes fit in one list.
export type AnyToolDef = ToolDef<ZodRawShape, ZodRawShape>;
export const asAny = <I extends ZodRawShape, O extends ZodRawShape>(t: ToolDef<I, O>) => t as unknown as AnyToolDef;
