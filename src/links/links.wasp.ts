import { action, api, page, query, route, type Spec } from "@wasp.sh/spec";
import { createLink, deleteLink, getLink, getLinks, updateLink } from "./operations" with { type: "ref" };
import { LinkDetailPage } from "./ui/LinkDetailPage" with { type: "ref" };
import { LinksPage } from "./ui/LinksPage" with { type: "ref" };
import { NewLinkPage } from "./ui/NewLinkPage" with { type: "ref" };
import { restLink, restLinks } from "./rest" with { type: "ref" };

export const linksSpec: Spec = [
  // Dashboard
  route("LinksRoute", "/links", page(LinksPage, { authRequired: true })),
  route("NewLinkRoute", "/links/new", page(NewLinkPage, { authRequired: true })),
  route("LinkDetailRoute", "/links/:id", page(LinkDetailPage, { authRequired: true })),
  query(getLinks, { entities: ["Link"] }),
  query(getLink, { entities: ["Link"] }),
  action(createLink, { entities: ["Link"] }),
  action(updateLink, { entities: ["Link"] }),
  action(deleteLink, { entities: ["Link"] }),
  // REST API (bearer auth is handled in the handlers, so Wasp's session auth is off)
  api("ALL", "/api/v1/links", restLinks, { auth: false }),
  api("ALL", "/api/v1/links/:id", restLink, { auth: false }),
];
