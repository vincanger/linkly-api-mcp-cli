import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { asAny, defineTool } from "../mcp/defineTool";
import { linkIdSchema } from "../links/schemas";
import { GROUP_BYS, RANGES } from "./ranges";
import { LinkStats, TopLinks } from "./schemas";
import * as analytics from "./service";

const range = z
  .enum(RANGES)
  .optional()
  .describe("Time window: 24h = last 24 hours, 7d = last 7 days (default), 30d = last 30 days, 90d = last 90 days.");

export function analyticsTools({ prisma }: { prisma: PrismaClient }) {
  const deps = { prisma };
  return [
    asAny(
      defineTool({
        name: "get_link_stats",
        title: "Get click stats for a link",
        toolset: "analytics",
        scope: "analytics:read",
        description:
          "Returns click counts for one link (by ID or slug), either per day (zero-filled, oldest first) or per referring website. The returned dashboardUrl opens an interactive chart of the same data in Linkly: share it with the user when they want to see or explore the numbers. Use get_top_links to compare links.",
        input: {
          linkId: linkIdSchema,
          range,
          groupBy: z
            .enum(GROUP_BYS)
            .optional()
            .describe("day (default): clicks per UTC day. referrer: clicks per referring website, 'direct' when there was none."),
        },
        output: LinkStats.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: (p, input) => analytics.getLinkStats(p, input, deps),
      }),
    ),
    asAny(
      defineTool({
        name: "get_top_links",
        title: "Get most-clicked links",
        toolset: "analytics",
        scope: "analytics:read",
        description:
          "Ranks the user's links by clicks in a time window, most first (links with no clicks are left out). The returned dashboardUrl opens the same ranking in Linkly; suggest it when the user wants to browse. Use get_link_stats for one link's daily or referrer breakdown.",
        input: {
          range,
          limit: z.number().int().min(1).max(50).optional().describe("How many links to return, 1–50 (default 10)."),
        },
        output: TopLinks.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: (p, input) => analytics.getTopLinks(p, input, deps),
      }),
    ),
  ];
}
