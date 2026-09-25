import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { errorResponses, security } from "../openapi/common";
import { Whoami } from "./schemas";

export function registerAccountOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/me",
    operationId: "whoami",
    tags: ["Account"],
    summary: "Who am I",
    description: "Returns the caller's identity and permissions. Useful for checking a token.",
    security: security(),
    "x-destructive": false,
    responses: {
      200: { description: "The caller.", content: { "application/json": { schema: Whoami } } },
      ...errorResponses(401),
    },
  });
}
