import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { errorResponses } from "../openapi/common";
import { z } from "../shared/zod";
import { DocOut, DocSearchResults } from "./schemas";

export function registerDocsOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/docs/search",
    operationId: "searchDocs",
    tags: ["Docs"],
    summary: "Search the docs",
    description: "Public. Returns the best-matching docs with snippets.",
    security: [],
    "x-destructive": false,
    request: {
      query: z.object({
        q: z.string().min(1).describe("What you want to know, in plain words."),
        limit: z.coerce.number().int().min(1).max(20).optional().describe("Maximum results (default 5)."),
      }),
    },
    responses: { 200: { description: "Results.", content: { "application/json": { schema: DocSearchResults } } }, ...errorResponses(400) },
  });
  registry.registerPath({
    method: "get",
    path: "/docs/{slug}",
    operationId: "readDoc",
    tags: ["Docs"],
    summary: "Read a doc",
    description: "Public. Returns one doc as Markdown.",
    security: [],
    "x-destructive": false,
    request: { params: z.object({ slug: z.string().describe("The doc's slug.") }) },
    responses: { 200: { description: "The doc.", content: { "application/json": { schema: DocOut } } }, ...errorResponses(404) },
  });
}
