import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../shared/zod";
import type { Scope } from "../shared/scopes";

export const ErrorBody = z
  .object({
    error: z.object({
      code: z.string().describe("Machine-readable error code, e.g. not_found, forbidden, conflict, invalid, unauthorized."),
      message: z.string().describe("Human-readable explanation, often with what to do next."),
    }),
  })
  .openapi("Error");

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Invalid input.",
  401: "Missing, invalid, or expired token.",
  403: "The token doesn't have the required scope.",
  404: "Not found (or owned by someone else).",
  409: "Conflict, e.g. the slug is taken.",
};

export function errorResponses(...codes: number[]) {
  return Object.fromEntries(
    codes.map((code) => [code, { description: ERROR_DESCRIPTIONS[code] ?? "Error.", content: { "application/json": { schema: ErrorBody } } }]),
  );
}

/** Accepts a personal access token, or an OAuth token with the given scope. */
export function security(scope?: Scope): Record<string, string[]>[] {
  return [{ bearer: [] }, { oauth2: scope ? [scope] : [] }];
}

export function registerCommon(registry: OpenAPIRegistry): void {
  registry.register("Error", ErrorBody);
}
