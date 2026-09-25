import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { errorResponses, security } from "../openapi/common";
import { z } from "../shared/zod";
import { DeleteResult, LinkInput, LinkListQuery, LinkOut, LinkPage, LinkUpdate } from "./schemas";

const idParams = z.object({ id: z.string().describe("The link's ID or slug.") });
const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });

export function registerLinksOpenApi(registry: OpenAPIRegistry): void {
  registry.register("Link", LinkOut);

  registry.registerPath({
    method: "get",
    path: "/links",
    operationId: "listLinks",
    tags: ["Links"],
    summary: "List links",
    description: "Your links, newest first, with optional search and tag filters. Cursor-paginated.",
    security: security("links:read"),
    "x-destructive": false,
    request: { query: LinkListQuery },
    responses: { 200: { description: "A page of links.", ...json(LinkPage) }, ...errorResponses(400, 401, 403) },
  });

  registry.registerPath({
    method: "post",
    path: "/links",
    operationId: "createLink",
    tags: ["Links"],
    summary: "Create a link",
    description: "Creates a short link. Omit `slug` to get a random 7-character one.",
    security: security("links:write"),
    "x-destructive": false,
    request: { body: { required: true, ...json(LinkInput) } },
    responses: { 201: { description: "The created link.", ...json(LinkOut) }, ...errorResponses(400, 401, 403, 409) },
  });

  registry.registerPath({
    method: "get",
    path: "/links/{id}",
    operationId: "getLink",
    tags: ["Links"],
    summary: "Get a link",
    description: "Looks up one link by ID or slug.",
    security: security("links:read"),
    "x-destructive": false,
    request: { params: idParams },
    responses: { 200: { description: "The link.", ...json(LinkOut) }, ...errorResponses(401, 403, 404) },
  });

  registry.registerPath({
    method: "patch",
    path: "/links/{id}",
    operationId: "updateLink",
    tags: ["Links"],
    summary: "Update a link",
    description: "Changes only the fields you send. Setting `archived: true` stops the short URL from redirecting.",
    security: security("links:write"),
    "x-destructive": false,
    request: { params: idParams, body: { required: true, ...json(LinkUpdate) } },
    responses: { 200: { description: "The updated link.", ...json(LinkOut) }, ...errorResponses(400, 401, 403, 404, 409) },
  });

  registry.registerPath({
    method: "delete",
    path: "/links/{id}",
    operationId: "deleteLink",
    tags: ["Links"],
    summary: "Delete a link",
    description:
      "Permanently deletes a link and its click history. With a personal access token it's deleted immediately (200). With an OAuth token whose connection requires confirmation, nothing is deleted yet: you get 202 with a `confirmUrl` to share with the user.",
    security: security("links:write"),
    "x-destructive": true,
    request: { params: idParams },
    responses: {
      200: { description: "Deleted.", ...json(DeleteResult) },
      202: { description: "Confirmation required: share `confirmUrl` with the user.", ...json(DeleteResult) },
      ...errorResponses(401, 403, 404),
    },
  });
}
