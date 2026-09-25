import { api, page, route, type Spec } from "@wasp.sh/spec";
import { restDoc, restDocSearch } from "./rest" with { type: "ref" };
import { DocPage, DocsIndexPage } from "./ui/DocsPage" with { type: "ref" };

export const docsSpec: Spec = [
  // Dashboard (public)
  route("DocsRoute", "/docs", page(DocsIndexPage)),
  route("DocRoute", "/docs/:slug", page(DocPage)),
  // REST API (public)
  api("GET", "/api/v1/docs/search", restDocSearch, { auth: false }),
  api("GET", "/api/v1/docs/:slug", restDoc, { auth: false }),
];
