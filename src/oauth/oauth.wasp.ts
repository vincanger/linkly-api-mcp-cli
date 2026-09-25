import { action, api, page, query, route, type Spec } from "@wasp.sh/spec";
import {
  approveAuthorization,
  denyAuthorization,
  getAuthorizeRequest,
  getGrants,
  revokeGrant,
  updateGrant,
} from "./operations" with { type: "ref" };
import {
  oauthRevoke,
  oauthToken,
  wellKnownAuthorizationServer,
  wellKnownProtectedResource,
  wellKnownProtectedResourceApi,
  wellKnownProtectedResourceMcp,
} from "./routes" with { type: "ref" };
import { ConnectionsPage } from "./ui/ConnectionsPage" with { type: "ref" };
import { ConsentPage } from "./ui/ConsentPage" with { type: "ref" };

export const oauthSpec: Spec = [
  // Metadata (RFC 9728, RFC 8414)
  api("GET", "/.well-known/oauth-protected-resource", wellKnownProtectedResource, { auth: false }),
  api("GET", "/.well-known/oauth-protected-resource/mcp", wellKnownProtectedResourceMcp, { auth: false }),
  api("GET", "/.well-known/oauth-protected-resource/api/v1", wellKnownProtectedResourceApi, { auth: false }),
  api("GET", "/.well-known/oauth-authorization-server", wellKnownAuthorizationServer, { auth: false }),
  // Token + revocation endpoints (public clients, PKCE)
  api("POST", "/oauth/token", oauthToken, { auth: false }),
  api("POST", "/oauth/revoke", oauthRevoke, { auth: false }),
  // The authorization endpoint is a page on the frontend origin: it reuses Wasp's login.
  route("OAuthAuthorizeRoute", "/oauth/authorize", page(ConsentPage)),
  query(getAuthorizeRequest, { entities: ["OAuthClientCache"] }),
  action(approveAuthorization, { entities: ["AuthorizationCode", "OAuthClientCache"] }),
  action(denyAuthorization, { entities: ["OAuthClientCache"] }),
  // Connected apps
  route("ConnectionsRoute", "/settings/connections", page(ConnectionsPage, { authRequired: true })),
  query(getGrants, { entities: ["Grant", "AccessToken"] }),
  action(updateGrant, { entities: ["Grant"] }),
  action(revokeGrant, { entities: ["Grant", "AccessToken"] }),
];
