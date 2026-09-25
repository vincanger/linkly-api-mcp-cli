import { action, page, query, route, type Spec } from "@wasp.sh/spec";
import { createPat, getPats, revokePat } from "./operations" with { type: "ref" };
import { TokensPage } from "./ui/TokensPage" with { type: "ref" };

export const tokensSpec: Spec = [
  route("TokensRoute", "/settings/tokens", page(TokensPage, { authRequired: true })),
  query(getPats, { entities: ["AccessToken"] }),
  action(createPat, { entities: ["AccessToken"] }),
  action(revokePat, { entities: ["AccessToken"] }),
];
