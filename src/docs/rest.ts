import type { RestDocSearch, RestDoc } from "wasp/server/api";
import { publicHandler } from "../shared/http";
import { readDoc, searchDocs } from "./service";

export const restDocSearch: RestDocSearch = publicHandler((req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  res.json(searchDocs({ query: q, limit }));
});

export const restDoc: RestDoc = publicHandler((req, res) => {
  // `/docs/search` is its own route; guard against route ordering anyway.
  if (req.params.slug === "search") return restDocSearch(req, res, {} as never);
  res.json(readDoc({ slug: String(req.params.slug) }));
});
