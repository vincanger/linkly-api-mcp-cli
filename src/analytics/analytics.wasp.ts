import { api, page, query, route, type Spec } from "@wasp.sh/spec";
import { getLinkStats, getTopLinks } from "./operations" with { type: "ref" };
import { redirect } from "./redirect" with { type: "ref" };
import { TopLinksPage } from "./ui/TopLinksPage" with { type: "ref" };

export const analyticsSpec: Spec = [
  // Public short URLs
  api("GET", "/r/:slug", redirect, { auth: false }),
  // Dashboard
  route("TopLinksRoute", "/analytics", page(TopLinksPage, { authRequired: true })),
  query(getLinkStats, { entities: ["Link", "Click"] }),
  query(getTopLinks, { entities: ["Link", "Click"] }),
];
