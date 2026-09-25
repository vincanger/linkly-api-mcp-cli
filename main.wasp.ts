import { apiNamespace, app } from "@wasp.sh/spec";
import { Layout } from "./src/app/Layout" with { type: "ref" };
import { mcpMiddleware, oauthMiddleware, restMiddleware, wellKnownMiddleware } from "./src/shared/http" with { type: "ref" };
import { serverSetup } from "./src/shared/serverSetup" with { type: "ref" };
import { appSpec } from "./src/app/app.wasp";

// The Wasp Spec only joins the slices. Each slice declares its own pages,
// routes, operations, and APIs in its `<slice>.wasp.ts` file.
export default app({
  name: "linkly",
  wasp: { version: "^0.25.0" },
  title: "Linkly",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      email: {
        fromField: { name: "Linkly", email: "hello@linkly.local" },
        emailVerification: { clientRoute: "EmailVerificationRoute" },
        passwordReset: { clientRoute: "PasswordResetRoute" },
      },
    },
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/",
  },
  emailSender: { provider: "Dummy" },
  client: { rootComponent: Layout },
  server: { setupFn: serverSetup },
  spec: [
    apiNamespace("/api/v1", { middlewareConfigFn: restMiddleware }),
    apiNamespace("/mcp", { middlewareConfigFn: mcpMiddleware }),
    apiNamespace("/oauth", { middlewareConfigFn: oauthMiddleware }),
    apiNamespace("/.well-known", { middlewareConfigFn: wellKnownMiddleware }),
    appSpec,
  ],
});
