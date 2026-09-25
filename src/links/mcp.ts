// MCP tools for the "links" toolset. Thin adapters over service.ts.
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { asAny, defineTool } from "../mcp/defineTool";
import { MAX_LIMIT } from "../shared/pagination";
import {
  destinationUrlSchema,
  linkIdSchema,
  LinkOut,
  LinkPage,
  slugSchema,
  tagsSchema,
  titleSchema,
} from "./schemas";
import * as links from "./service";

export const DeleteToolOutput = {
  status: z
    .enum(["deleted", "confirmation_required"])
    .describe("deleted: the link is gone. confirmation_required: nothing was deleted yet; share confirmUrl with the user."),
  id: z.string().optional().describe("ID of the deleted link (status deleted)."),
  slug: z.string().optional().describe("Slug of the link."),
  confirmUrl: z.string().optional().describe("Link the user must open to confirm the deletion (status confirmation_required)."),
  actionId: z.string().optional().describe("ID of the pending deletion."),
  expiresAt: z.string().optional().describe("When the confirmation link expires (ISO 8601)."),
  message: z.string().optional().describe("What to tell the user."),
};

export function linksTools({ prisma }: { prisma: PrismaClient }) {
  const deps = { prisma };
  return [
    asAny(
      defineTool({
        name: "list_links",
        title: "List links",
        toolset: "links",
        scope: "links:read",
        description:
          "Lists the user's short links, newest first. Filter with `search` (matches slug, title, and destination) or `tag`. Results are paginated: pass `nextCursor` back as `cursor` for more. Use get_link for one link and get_link_stats for its clicks.",
        input: {
          search: z.string().max(200).optional().describe("Case-insensitive text matched against slug, title, and destination URL."),
          tag: z.string().max(30).optional().describe("Only return links that have this tag."),
          archived: z.boolean().optional().describe("false or omitted: active links only. true: archived links only."),
          cursor: z.string().optional().describe("The `nextCursor` from a previous list_links call, to get the next page."),
          limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`How many links to return, 1–${MAX_LIMIT} (default 25).`),
        },
        output: LinkPage.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: (p, input) => links.listLinks(p, input, deps),
      }),
    ),
    asAny(
      defineTool({
        name: "get_link",
        title: "Get a link",
        toolset: "links",
        scope: "links:read",
        description:
          "Gets one short link by its ID or its slug (either works). Returns the destination, tags, short URL, and a dashboardUrl to open it in Linkly. Use list_links to find links, get_link_stats for clicks.",
        input: { id: linkIdSchema },
        output: LinkOut.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: (p, input) => links.getLink(p, input, deps),
      }),
    ),
    asAny(
      defineTool({
        name: "create_link",
        title: "Create a link",
        toolset: "links",
        scope: "links:write",
        description:
          "Creates a short link that redirects to `destinationUrl`. Omit `slug` for a random 7-character one; a taken slug returns a conflict error. Returns the new link with its `shortUrl` to share. To change it later use update_link.",
        input: {
          destinationUrl: destinationUrlSchema,
          slug: slugSchema.optional().describe("Custom slug (3–40 chars of a-z, 0-9, '-'). Omit it for a random one."),
          title: titleSchema.optional().describe("Optional human-readable label for the link."),
          tags: tagsSchema.optional().describe("Up to 10 tags (each up to 30 chars) for grouping and filtering. Stored lowercase."),
        },
        output: LinkOut.shape,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        handler: (p, input) => links.createLink(p, input, deps),
      }),
    ),
    asAny(
      defineTool({
        name: "update_link",
        title: "Update a link",
        toolset: "links",
        scope: "links:write",
        description:
          "Changes a link's destination, slug, title, tags, or archived state. Only the fields you pass change; `tags` replaces the whole list. Archiving (archived: true) stops the short URL from redirecting without deleting it; prefer it over delete_link when the user might want the link back.",
        input: {
          id: linkIdSchema,
          destinationUrl: destinationUrlSchema.optional().describe("New destination URL (http:// or https://)."),
          slug: slugSchema.optional().describe("New slug (3–40 chars of a-z, 0-9, '-'). The old short URL stops working."),
          title: z.string().max(200).nullable().optional().describe("New title, or null to remove it."),
          tags: tagsSchema.optional().describe("Replaces the whole tag list."),
          archived: z.boolean().optional().describe("true: stop redirecting and hide from lists. false: restore."),
        },
        output: LinkOut.shape,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        handler: (p, input) => links.updateLink(p, input, deps),
      }),
    ),
    asAny(
      defineTool({
        name: "delete_link",
        title: "Delete a link",
        toolset: "links",
        scope: "links:write",
        description:
          "Permanently deletes a link and its click history. Depending on the user's settings it either deletes immediately (status deleted) or returns status confirmation_required with a confirmUrl: then nothing is deleted until the user opens that link and confirms, so share it with them. Consider update_link with archived: true instead if they might want it back.",
        input: { id: linkIdSchema },
        output: DeleteToolOutput,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
        handler: (p, input) => links.requestDeletion(p, input, deps),
      }),
    ),
  ];
}
