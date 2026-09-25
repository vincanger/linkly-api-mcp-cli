// Input/output shapes for links. The same schemas validate Wasp operation
// args, REST bodies, and MCP tool input, and generate the OpenAPI document.
import { z } from "../shared/zod";
import { cursorSchema, limitSchema } from "../shared/pagination";

export const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

export const destinationUrlSchema = z
  .url({ protocol: /^https?$/, error: "Must be an http:// or https:// URL." })
  .max(2048)
  .describe("The full URL the short link redirects to. Must start with http:// or https://.");

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, "Slugs are 3–40 characters: lowercase letters, numbers, and hyphens.")
  .describe("Custom short code used in the short URL (/r/<slug>). 3–40 chars of a-z, 0-9, and '-'.");

export const titleSchema = z.string().trim().max(200).describe("Optional human-readable label for the link.");

export const tagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(10)
  .describe("Up to 10 tags (each up to 30 chars) for grouping and filtering links. Stored lowercase.");

export const linkIdSchema = z
  .string()
  .min(1)
  .describe("The link's ID or its slug. Either works.");

export const LinkInput = z
  .object({
    destinationUrl: destinationUrlSchema,
    slug: slugSchema.optional().describe("Custom slug. Omit it to get a random 7-character slug."),
    title: titleSchema.optional(),
    tags: tagsSchema.optional(),
  })
  .openapi("LinkInput");
export type LinkInput = z.infer<typeof LinkInput>;

export const LinkUpdate = z
  .object({
    destinationUrl: destinationUrlSchema.optional(),
    slug: slugSchema.optional(),
    title: titleSchema.nullable().optional().describe("New title. Pass null to remove it."),
    tags: tagsSchema.optional().describe("Replaces the whole tag list."),
    archived: z
      .boolean()
      .optional()
      .describe("Archived links stop redirecting (their short URL returns 404) and are hidden from lists by default."),
  })
  .openapi("LinkUpdate");
export type LinkUpdate = z.infer<typeof LinkUpdate>;

export const LinkListQuery = z
  .object({
    search: z
      .string()
      .trim()
      .max(200)
      .optional()
      .describe("Case-insensitive text matched against slug, title, and destination URL."),
    tag: z.string().trim().toLowerCase().max(30).optional().describe("Only links that have this tag."),
    archived: z
      .union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")])
      .default(false)
      .describe("false (default): only active links. true: only archived links."),
    cursor: cursorSchema,
    limit: limitSchema,
  })
  .openapi("LinkListQuery");
// What callers may pass (query strings arrive as strings).
export type LinkListQuery = {
  search?: string;
  tag?: string;
  archived?: boolean | "true" | "false";
  cursor?: string;
  limit?: number | string;
};

export const LinkOut = z
  .object({
    id: z.string().describe("Stable link ID."),
    slug: z.string().describe("Short code; the short URL is /r/<slug>."),
    destinationUrl: z.string().describe("Where the short link redirects."),
    title: z.string().nullable().describe("Optional label."),
    tags: z.array(z.string()).describe("Tags on the link."),
    archived: z.boolean().describe("Whether the link is archived (not redirecting)."),
    createdAt: z.string().describe("ISO 8601 creation time."),
    updatedAt: z.string().describe("ISO 8601 last update time."),
    shortUrl: z.string().describe("The public short URL to share."),
    dashboardUrl: z.string().describe("Opens this link in the Linkly dashboard."),
  })
  .openapi("Link");
export type LinkOut = z.infer<typeof LinkOut>;

export const LinkPage = z
  .object({
    data: z.array(LinkOut).describe("Links on this page, newest first."),
    nextCursor: z.string().nullable().describe("Pass as `cursor` to get the next page; null when there are no more."),
  })
  .openapi("LinkPage");

export const DeleteResult = z
  .discriminatedUnion("status", [
    z.object({
      status: z.literal("deleted").describe("The link was deleted."),
      id: z.string().describe("ID of the deleted link."),
      slug: z.string().describe("Slug of the deleted link."),
    }),
    z.object({
      status: z.literal("confirmation_required").describe("The user must confirm in Linkly before anything is deleted."),
      confirmUrl: z.string().describe("Share this URL with the user; the link is deleted when they confirm."),
      actionId: z.string().describe("ID of the pending deletion."),
      expiresAt: z.string().describe("ISO 8601 time when the confirmation link expires."),
      message: z.string().describe("Explanation to relay to the user."),
    }),
  ])
  .openapi("DeleteResult");
export type DeleteResult = z.infer<typeof DeleteResult>;
