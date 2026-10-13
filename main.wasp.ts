import { apiNamespace, app } from "@wasp.sh/spec";
import { Layout } from "./src/app/Layout" with { type: "ref" };
import { mcpMiddleware, oauthMiddleware, restMiddleware, wellKnownMiddleware } from "./src/shared/http" with { type: "ref" };
import { serverSetup } from "./src/shared/serverSetup" with { type: "ref" };
import { appSpec } from "./src/app/app.wasp";
import { linksSpec } from "./src/links/links.wasp";
import { analyticsSpec } from "./src/analytics/analytics.wasp";
import { testingSpec } from "./src/testing/testing.wasp";
import { accountSpec } from "./src/account/account.wasp";
import { tokensSpec } from "./src/tokens/tokens.wasp";
import { openapiSpec } from "./src/openapi/openapi.wasp";
import { oauthSpec } from "./src/oauth/oauth.wasp";
import { mcpSpec } from "./src/mcp/mcp.wasp";
import { docsSpec } from "./src/docs/docs.wasp";
import { deeplinksSpec } from "./src/deeplinks/deeplinks.wasp";
import { discoverySpec } from "./src/discovery/discovery.wasp";
import { LLMS_TXT_PATH } from "./src/discovery/paths";

// The Wasp Spec only joins the slices. Each slice declares its own pages,
// routes, operations, and APIs in its `<slice>.wasp.ts` file.
export default app({
  name: "linkly",
  wasp: { version: "^0.25.0" },
  title: "Linkly",
  head: [
    "<link rel='icon' href='/favicon.ico' />",
    // Cheap, but few agents look for it: the "For AI agents" text on the homepage is what they read.
    `<link rel='alternate' type='text/markdown' href='${LLMS_TXT_PATH}' />`,
  ],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/links",
  },
  client: { rootComponent: Layout },
  server: { setupFn: serverSetup },
  spec: [
    apiNamespace("/api/v1", { middlewareConfigFn: restMiddleware }),
    apiNamespace("/mcp", { middlewareConfigFn: mcpMiddleware }),
    apiNamespace("/oauth", { middlewareConfigFn: oauthMiddleware }),
    apiNamespace("/.well-known", { middlewareConfigFn: wellKnownMiddleware }),
    appSpec,
    linksSpec,
    analyticsSpec,
    accountSpec,
    tokensSpec,
    openapiSpec,
    oauthSpec,
    mcpSpec,
    docsSpec,
    deeplinksSpec,
    discoverySpec,
    testingSpec,
  ],
});
