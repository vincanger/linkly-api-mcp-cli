import { z } from "../shared/zod";
import { linkIdSchema, LinkOut } from "../links/schemas";
import { GROUP_BYS, RANGES } from "./ranges";

export const rangeSchema = z
  .enum(RANGES)
  .default("7d")
  .describe("Time window: 24h = last 24 hours, 7d = last 7 days (default), 30d = last 30 days, 90d = last 90 days.");

export const groupBySchema = z
  .enum(GROUP_BYS)
  .default("day")
  .describe("day (default): one entry per UTC day, including days with zero clicks. referrer: one entry per referring website (\"direct\" when there was none).");

export const StatsQuery = z
  .object({
    linkId: linkIdSchema,
    range: rangeSchema,
    groupBy: groupBySchema,
  })
  .openapi("StatsQuery");
export type StatsQuery = { linkId: string; range?: z.input<typeof rangeSchema>; groupBy?: z.input<typeof groupBySchema> };

export const TopLinksQuery = z
  .object({
    range: rangeSchema,
    limit: z.coerce.number().int().min(1).max(50).default(10).describe("How many links to return, 1–50. Defaults to 10."),
  })
  .openapi("TopLinksQuery");
export type TopLinksQuery = { range?: z.input<typeof rangeSchema>; limit?: number | string };

export const LinkStats = z
  .object({
    linkId: z.string().describe("ID of the link."),
    slug: z.string().describe("Slug of the link."),
    range: z.enum(RANGES).describe("The time window used."),
    groupBy: z.enum(GROUP_BYS).describe("How the series is grouped."),
    total: z.number().int().describe("Total clicks in the time window."),
    series: z
      .array(z.object({ key: z.string().describe("A UTC day (YYYY-MM-DD) or a referrer hostname."), clicks: z.number().int().describe("Clicks for this key.") }))
      .describe("Click counts per key. Days are oldest first; referrers are most clicks first."),
    dashboardUrl: z.string().describe("Opens an interactive chart of these stats in the Linkly dashboard. Share it with the user."),
  })
  .openapi("LinkStats");
export type LinkStats = z.infer<typeof LinkStats>;

export const TopLinks = z
  .object({
    range: z.enum(RANGES).describe("The time window used."),
    data: z
      .array(z.object({ link: LinkOut, clicks: z.number().int().describe("Clicks in the time window.") }))
      .describe("Links with the most clicks, most first. Links with zero clicks are left out."),
    dashboardUrl: z.string().describe("Opens the top-links view in the Linkly dashboard. Share it with the user."),
  })
  .openapi("TopLinks");
export type TopLinks = z.infer<typeof TopLinks>;
