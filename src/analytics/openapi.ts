import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { errorResponses, security } from "../openapi/common";
import { z } from "../shared/zod";
import { groupBySchema, LinkStats, rangeSchema, TopLinks, TopLinksQuery } from "./schemas";

export function registerAnalyticsOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/links/{id}/stats",
    operationId: "getLinkStats",
    tags: ["Analytics"],
    summary: "Click stats for a link",
    description: "Clicks per day (zero-filled) or per referrer. `dashboardUrl` opens an interactive chart.",
    security: security("analytics:read"),
    "x-destructive": false,
    request: {
      params: z.object({ id: z.string().describe("The link's ID or slug.") }),
      query: z.object({ range: rangeSchema, groupBy: groupBySchema }),
    },
    responses: {
      200: { description: "Stats.", content: { "application/json": { schema: LinkStats } } },
      ...errorResponses(400, 401, 403, 404),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/analytics/top-links",
    operationId: "getTopLinks",
    tags: ["Analytics"],
    summary: "Most-clicked links",
    description: "Your links ranked by clicks in the time range.",
    security: security("analytics:read"),
    "x-destructive": false,
    request: { query: TopLinksQuery },
    responses: {
      200: { description: "Top links.", content: { "application/json": { schema: TopLinks } } },
      ...errorResponses(400, 401, 403),
    },
  });
}
