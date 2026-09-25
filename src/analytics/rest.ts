import { prisma } from "wasp/server";
import type { RestLinkStats, RestTopLinks } from "wasp/server/api";
import { withBearer } from "../shared/http";
import * as analytics from "./service";

const deps = { prisma };

export const restLinkStats: RestLinkStats = withBearer("api", async (req, res, p) => {
  const q = req.query as Record<string, string>;
  res.json(await analytics.getLinkStats(p, { linkId: String(req.params.id), range: q.range as never, groupBy: q.groupBy as never }, deps));
});

export const restTopLinks: RestTopLinks = withBearer("api", async (req, res, p) => {
  res.json(await analytics.getTopLinks(p, req.query as Record<string, string> as never, deps));
});
