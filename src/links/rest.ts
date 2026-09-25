// REST adapters for /api/v1/links: parse input, call the service, format output.
import { prisma } from "wasp/server";
import type { RestLink, RestLinks } from "wasp/server/api";
import { byMethod, withBearer } from "../shared/http";
import * as links from "./service";

const deps = { prisma };

export const restLinks: RestLinks = byMethod({
  GET: withBearer("api", async (req, res, p) => {
    res.json(await links.listLinks(p, req.query as Record<string, string>, deps));
  }),
  POST: withBearer("api", async (req, res, p) => {
    res.status(201).json(await links.createLink(p, req.body ?? {}, deps));
  }),
});

// Wasp's api() has no PATCH, so /links/:id is an "ALL" route dispatched here.
export const restLink: RestLink = byMethod({
  GET: withBearer("api", async (req, res, p) => {
    res.json(await links.getLink(p, { id: String(req.params.id) }, deps));
  }),
  PATCH: withBearer("api", async (req, res, p) => {
    res.json(await links.updateLink(p, { ...(req.body ?? {}), id: String(req.params.id) }, deps));
  }),
  DELETE: withBearer("api", async (req, res, p) => {
    res.json(await links.deleteLink(p, { id: String(req.params.id) }, deps));
  }),
});
