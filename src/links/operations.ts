// Wasp operations for the dashboard: thin adapters over service.ts.
import { prisma } from "wasp/server";
import type { CreateLink, DeleteLink, GetLink, GetLinks, UpdateLink } from "wasp/server/operations";
import type { Page } from "../shared/pagination";
import { runOperation } from "../shared/waspErrors";
import { sessionPrincipal } from "../shared/waspSession";
import type { LinkInput, LinkListQuery, LinkOut, LinkUpdate } from "./schemas";
import * as links from "./service";

const deps = { prisma };

export const getLinks: GetLinks<LinkListQuery, Page<LinkOut>> = (args, context) =>
  runOperation(() => links.listLinks(sessionPrincipal(context), args ?? {}, deps));

export const getLink: GetLink<{ id: string }, LinkOut> = (args, context) =>
  runOperation(() => links.getLink(sessionPrincipal(context), args, deps));

export const createLink: CreateLink<LinkInput, LinkOut> = (args, context) =>
  runOperation(() => links.createLink(sessionPrincipal(context), args, deps));

export const updateLink: UpdateLink<{ id: string } & LinkUpdate, LinkOut> = (args, context) =>
  runOperation(() => links.updateLink(sessionPrincipal(context), args, deps));

// The dashboard deletes directly after an in-UI confirm dialog: the human is
// already in the product, so no confirmation link is needed.
export const deleteLink: DeleteLink<{ id: string }, { status: "deleted"; id: string; slug: string }> = (
  args,
  context,
) => runOperation(() => links.deleteLink(sessionPrincipal(context), args, deps));
