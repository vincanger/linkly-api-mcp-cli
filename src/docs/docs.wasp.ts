import { api, page, route, type Spec } from "@wasp.sh/spec";
import { restDoc, restDocSearch } from "./rest" with { type: "ref" };
import { DOCS } from "./content";
import { DocPage, DocsIndexPage } from "./ui/DocsPage" with { type: "ref" };

export const docsSpec: Spec = [
  // Dashboard (public), prerendered so agents and llms.txt links get real HTML
  route("DocsRoute", "/docs", page(DocsIndexPage), { prerender: true }),
  route("DocRoute", "/docs/:slug", page(DocPage), { prerender: DOCS.map((d) => `/docs/${d.slug}`) }),
  // REST API (public)
  api("GET", "/api/v1/docs/search", restDocSearch, { auth: false }),
  api("GET", "/api/v1/docs/:slug", restDoc, { auth: false }),
];
