# Linkly build notes

Per-milestone notes and deviations from `linkly-mcp-spec.md`, written while building.

## Manual checks still to do

These can't be automated. The Playwright end-to-end tests cover the same flows headless.

- **MCP Inspector OAuth flow (M4).** Run the app (`wasp start db`, `wasp start`), then `npx @modelcontextprotocol/inspector`. Choose "Streamable HTTP", URL `http://localhost:3001/mcp`, and click Connect. Expected: the Inspector discovers the auth server from the 401, opens `http://localhost:3000/oauth/authorize`, you log in and click Allow, and the Inspector lists Linkly's tools. (The Inspector must publish a CIMD `client_id`; if the installed version only supports Dynamic Client Registration, this check waits for optional milestone M11.)

- **A real third-party MCP client end-to-end (M5).** Needs a public HTTPS URL for Linkly (for example a tunnel such as `cloudflared tunnel --url http://localhost:3001`, with `WASP_SERVER_URL`/`WASP_WEB_CLIENT_URL` set to the public URLs) and a real account in the client. In Claude: Settings → Connectors → Add custom connector → `<public server URL>/mcp`. Expected: Claude opens the Linkly consent page, you click Allow, and asking "list my Linkly links" and "create a short link to https://example.com" works. Then check the grant appears on `/settings/connections`.

## Decisions made without the author

Choices the spec or docs didn't settle, made conservatively so the build could continue.

- **URLs come from env, set by Wasp at startup.** `src/shared/urls.ts` reads `WASP_SERVER_URL` / `WASP_WEB_CLIENT_URL` (Wasp's own env vars, with Wasp's dev defaults) and the server `setupFn` re-applies Wasp's validated `env` values. This keeps `urls.ts` free of `wasp/*` imports so unit tests can use it. The spec said "use Wasp's server `config`"; the values are the same.
- **`toWaspHttpError` lives in `src/shared/waspErrors.ts`**, not `errors.ts`, because it needs `HttpError` from `wasp/server` and `errors.ts` must stay framework-free for unit tests.
- **Bearer auth is a handler wrapper (`withBearer`), not namespace middleware.** Some `/api/v1` routes are public (docs, `openapi.json`), so auth is applied per handler. The logic lives in `src/shared/bearer.ts` (framework-free) and `withBearer` adds the `WWW-Authenticate` header on 401.
- **Test-only fixture API.** `POST /__test/users` (in `src/testing/`) creates an already-verified user with Wasp's `createUser` + `sanitizeAndSerializeProviderData`, because passwords must be hashed the way Wasp does it and tests run in a separate process. It returns 404 unless `LINKLY_ENABLE_TEST_API=true` and `NODE_ENV` isn't `production`. Only `playwright.config.ts` sets that variable.
- **Every link lookup accepts an ID or a slug** (get, update, delete, stats), not only `getLink`: agents often only know the slug.
- **Service outputs use ISO strings for dates**, so the same object is valid JSON for REST, MCP `structuredContent`, and the CLI.
- **Random slugs** use a 32-character alphabet without look-alike characters (no `l`, `o`, `0`, `1`).
- **Where the user returns after logging in during OAuth.** Wasp's login always redirects to `onAuthSucceededRedirectTo`. The consent page stores the full `/oauth/authorize?...` URL in `sessionStorage` before sending the user to `/login`, and the layout sends them back after login (`src/app/returnTo.ts`).
- **Granted scopes are the chosen toolsets' scopes, limited to what the client requested.** A client that asks only for `links:read` never gets `links:write`, even if the user ticks "Links". With no `scope` parameter, every toolset is offered.
- **`/.well-known/oauth-protected-resource/api/v1` is served now** (the spec lists it under optional M10), because REST 401s already point to it and OAuth tokens with `resource=/api/v1` are accepted since M4.
- **Revoking a refresh token at `/oauth/revoke` revokes the whole grant**, including its access tokens (RFC 7009 allows this).
- **The deletion decision and pending-action service were built in M5** (with `delete_link`), not M7, so the tool never had an unsafe "always delete" phase. M7 adds the confirm page and the rest of the deep-link work.
- **The MCP transport returns JSON responses** (`enableJsonResponse: true`) rather than SSE streams: every call is a single request/response in stateless mode, so there's nothing to stream. Still standard Streamable HTTP; SDK clients handle both.
- **Extra columns:** `AuthorizationCode.grantId` (so reusing a code can revoke the grant it created) and `AuthorizationCode.createdAt`, plus an index on `Grant(userId, clientId)`.

## Environment notes

- `wasp start` stalls after "Building SDK" when stdin is an open pipe (how Playwright launches it). `playwright.config.ts` runs `wasp start < /dev/null`.
- Two `apiNamespace`s can't share a `middlewareConfigFn` name in the Wasp Spec (the name is derived from it), so `/.well-known` uses `wellKnownMiddleware`.
- Dev database: `wasp start db` (Postgres 18 in Docker). Tests use the `linkly_test` database in the same container (`CREATE DATABASE linkly_test;`); override with `TEST_DATABASE_URL`.
- Wasp's default password rules require at least 8 characters and a number.

---

## M0: Scaffold and shared kernel

**Built**
- Wasp 0.25 app (`wasp new -t minimal`) using the Wasp Spec: `main.wasp.ts` joins per-slice `*.wasp.ts` files (`src/app/app.wasp.ts` so far).
- Email auth with the Dummy email sender, Postgres, and the full Prisma schema from spec §4 (initial migration `init`).
- Tailwind v4 via `@tailwindcss/vite`, shadcn/ui initialized per spec §2.3 (Radix + Luma). Components added: button, input, label, textarea, table, badge, card, dialog, alert-dialog, dropdown-menu, select, checkbox, switch, tabs, sonner, skeleton, chart. Two generated `src/components/ui/button` imports were rewritten to relative paths. The temporary `@` alias was removed from `tsconfig.json`.
- `src/shared/`: `scopes.ts`, `principal.ts`, `errors.ts`, `urls.ts`, `pagination.ts`, `zod.ts`, `crypto.ts`, `bearer.ts` (framework-free) and `http.ts`, `waspErrors.ts`, `serverSetup.ts` (Wasp adapters). Permissive CORS on `/api/v1`, `/mcp`, `/oauth`, `/.well-known`.
- Layout (header nav, logout, toasts), home page, and Wasp auth pages (login, signup, email verification, password reset) wrapped in shadcn cards.
- Tests: root `vitest.config.ts` for server unit tests against `linkly_test`; `playwright.config.ts` for live-server tests.

**Tests**
- `npx vitest run`: `errors.test.ts`, `principal.test.ts`.
- `npx playwright test`: `e2e/auth.spec.ts` signs up, logs out, and logs back in.

**Deviations**
- shadcn's current `init` writes `src/lib/utils.ts` as `export { cn } from "cn"` (the new `cn` package) instead of the older `clsx` + `tailwind-merge` helper. Components import `cn` from `"cn"` directly, so they needed no alias fixes.
- `onAuthSucceededRedirectTo` is `/` until the `/links` page exists (M1).

## M1: Links slice (dashboard only)

**Built**
- `src/links/`: Zod schemas (`LinkInput`, `LinkUpdate`, `LinkListQuery`, `LinkOut`, `LinkPage`, `DeleteResult`, all with `.describe()` on every field), `service.ts` (list with search/tag/archived filters and cursor pagination, get by ID or slug, create with random or custom slug, update, delete), Wasp operations, and `links.wasp.ts`.
- `src/deeplinks/urls.ts` (pure builders) is in place early so every `LinkOut` carries `dashboardUrl` from the start.
- `src/shared/validate.ts`: `parseInput()` turns Zod failures into `DomainError("invalid")` inside services.
- UI: `/links` (table, search, tag filter, archived toggle, pagination, row actions, delete dialog), `/links/new` (form prefilled from query params), `/links/:id` (edit/stats tabs driven by `?tab=`, delete). Forms use react-hook-form with the slice's field schemas.
- Test fixtures: `e2e/fixtures/users.ts` creates verified users through the test-only API and logs in through the real login page.

**Tests**
- `src/links/service.test.ts`: ownership (another user can't read, update, or delete; reported as not found), slug conflict (including across users), ID-or-slug lookup, validation, tag normalization, scope check, pagination, filters, bad cursor.
- `e2e/links.spec.ts`: create (from a prefilled deep link), inline validation error, update, list/search/tag filter, server-side slug conflict, delete through the dialog, and another user's link showing "not found".

**Deviations**
- The spec lists shadcn's `form` component. The current shadcn registry for this style no longer has `form`; it ships `field` instead (used with react-hook-form's `Controller`). Linkly uses `field`.
- shadcn now also generates `import ... from "src/components/ui/..."` paths. These were rewritten to relative imports like the `@/` ones. Check with `grep -rn 'from "src/\|"@/' src/`.
- `src/shared/urls.ts` guards `process.env`, because the browser bundle imports the deep-link builders (it only uses their relative paths).

## M2: Redirect and analytics

**Built**
- `GET /r/:slug` (`src/analytics/redirect.ts`, public Wasp `api`): active links 302 to the destination; missing or archived links get a small 404 page. The click (referrer hostname only, user agent truncated to 200 chars) is recorded without awaiting it on the response path.
- `src/analytics/service.ts`: `getLinkStats` (by day, zero-filled, or by referrer with `direct` for none) and `getTopLinks`. Day grouping uses `date_trunc('day', ... AT TIME ZONE 'UTC')`. Multi-day ranges start at UTC midnight so each day bucket is complete (7d = today + 6 previous days); 24h is the exact last 24 hours.
- Both return a `dashboardUrl` that opens the matching chart (`/links/:id?tab=stats&range=&groupBy=`, `/analytics?range=`).
- UI: `StatsChart` (shadcn `chart` over recharts: line for days, bar for referrers, plus a screen-reader data table), `StatsPanel` on the link's Stats tab with range and group-by read from URL params, and `/analytics` (top links) with `?range=`.

**Tests**
- `src/analytics/service.test.ts`: range windows, zero-filled days, referrer grouping, ownership and scope, invalid range, top-link ranking scoped to the user, redirect resolution (archived → 404), referrer/user-agent storage.
- `e2e/analytics.spec.ts`: a short URL 302s and records clicks, unknown slugs 404, the stats tab reads `range`/`groupBy` from the URL, a 30-day chart has 30 entries with 29 zero days, the referrer view, and the top-links page.

**Deviations**
- The top-links view lives at `/analytics` (the spec names the builder `topLinks` but no path).
- E2E helpers: `logIn` waits for the post-login redirect, and `gotoReady` waits for network idle before filling forms, because an auth refetch right after navigation can re-render the page and wipe typed values.

## M3: REST API, PATs, and OpenAPI

**Built**
- `src/tokens/`: personal access tokens (`lk_pat_…`, SHA-256 stored, raw value shown once), session-only create/list/revoke, and `/settings/tokens` (name, permission checkboxes, expiry, a dialog that shows the new token once, revoke with confirmation, link to `openapi.json`).
- `src/shared/bearer.ts`: bearer authentication. PATs work on `/api/v1` and `/mcp`; OAuth tokens must match the resource's audience and take their scopes and `confirmDestructive` from the grant at request time; revoked or expired tokens are rejected; `lastUsedAt` is updated at most once a minute, fire-and-forget.
- REST handlers in each slice's `rest.ts`: `GET/POST /api/v1/links`, `GET/PATCH/DELETE /api/v1/links/:id`, `GET /api/v1/links/:id/stats`, `GET /api/v1/analytics/top-links`, and `GET /api/v1/me` (new `src/account/` slice, same shape as the `whoami` tool). All REST `api`s use `auth: false` so Wasp doesn't try to read our bearer tokens as session tokens.
- OpenAPI 3.1: each slice's `openapi.ts` registers its paths from its Zod schemas; `src/openapi/document.ts` assembles them with `bearer` and `oauth2` (authorization code + PKCE) security schemes and per-operation scopes; served publicly at `GET /api/v1/openapi.json`. Every operation has `x-destructive` (only `DELETE /links/{id}` is `true`).
- 401s on `/api/v1` already carry `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/api/v1"`.

**Tests**
- `src/tokens/service.test.ts`: hash-only storage, PATs can't mint PATs, PAT works on both resources until revoked, expiry, cross-user revoke, malformed headers, OAuth audience check, grant scopes winning over token scopes, revoked grant, `lastUsedAt` throttling.
- `src/openapi/document.test.ts`: validates with `@apidevtools/swagger-parser`, checks `x-destructive` on every operation, and security schemes/scopes.
- `e2e/rest.spec.ts`: a token created on the tokens page does full CRUD, stats, and top links over HTTP; 409/400/405/404 cases; revoking on the page makes it 401; a read-only token gets 403 naming the missing scope; no token gets 401 with `WWW-Authenticate`; the served `openapi.json` is public (CORS `*`) and valid.

**Deviations**
- Wasp's `api()` supports only `GET`, `POST`, `PUT`, `DELETE`, and `ALL`. `PATCH /api/v1/links/:id` is served by an `ALL` route that dispatches by method (`byMethod` in `src/shared/http.ts`) and returns 405 with an `Allow` header for anything else. `/api/v1/links` uses the same helper.
- The docs REST endpoints move to M6 with the rest of the docs slice (the spec lists them in both M3 and M6).
- `vite.config.ts` pre-bundles dependencies that are only discovered on some pages, and the Playwright global setup loads the app once before tests. Without this, Vite's first-visit dependency optimization reloads the page mid-test.

## M4: OAuth with CIMD

**Built**
- Metadata: `/.well-known/oauth-protected-resource` (+ `/mcp`, `/api/v1`) per RFC 9728 and `/.well-known/oauth-authorization-server` per RFC 8414 (`src/oauth/metadata.ts`).
- CIMD (`src/oauth/cimd.ts`): `client_id` must be an https URL with a path; documents are cached for 24h; `client_id` must match the document; `redirect_uris` required; `client_name` falls back to the host; exact redirect matching with RFC 8252 loopback port flexibility.
- SSRF guard (`src/oauth/ssrf.ts`): every resolved address is checked at connect time (so DNS rebinding can't bypass it) against private, loopback, link-local, CGNAT, multicast, and reserved ranges, IPv4 and IPv6 (including IPv4-mapped); IP literals are checked up front; 5s timeout, 64 KB limit, no redirects. The local-dev exception (`isAllowedLoopbackClient`) only applies in `development`/`test` and only to the literal hostnames `localhost`, `127.0.0.1`, `[::1]`.
- Authorize flow: `/oauth/authorize` is a Wasp page (on the frontend origin). It validates through the `getAuthorizeRequest` query; bad `client_id`/`redirect_uri` show an error and never redirect; other problems redirect back with `error=`, `state`, and `iss`. The consent screen shows the client name, the `client_id` host, an "unverified app" note, toolset checkboxes, and the confirmation toggle (default on).
- Token endpoint (`src/oauth/token.ts`): authorization code with PKCE S256 (codes are 60s, single use; reuse revokes the grant it created), one grant per user + client updated on re-consent, 1h access tokens with `audience = resource`, 30-day refresh tokens with single-use rotation and reuse detection (reuse revokes the grant). RFC 6749 error bodies, `Cache-Control: no-store`, form-encoded or JSON bodies.
- Revocation endpoint (`src/oauth/revoke.ts`, RFC 7009) and the connections page (`/settings/connections`): list grants with host and last use, edit toolsets and the confirmation toggle, revoke.

**Tests**
- `src/oauth/cimd.test.ts`: client_id URL rules, document validation (client_id mismatch, empty redirect_uris), redirect matching (exact, loopback any-port), blocked address ranges, local-dev exception (accepted in `test`, rejected in `production`), `10.0.0.5` and a hostname resolving to `127.0.0.1` rejected in every environment, `http://169.254.169.254` refused, 24h cache.
- `src/oauth/token.test.ts`: authorize validation and redirectable errors, deny, scope limiting, PKCE failure, redirect/client mismatch, code reuse revoking the grant, expired codes, grant reuse on re-consent, refresh rotation, refresh reuse detection revoking the grant, revocation.
- `e2e/oauth.spec.ts` (Playwright, headless): metadata endpoints; log in from the consent redirect, check client name and host, untick Analytics, Allow, exchange the code, use the token on `GET /api/v1/me` (analytics → 403), refresh rotation and reuse detection; Deny → `access_denied`; unknown `redirect_uri` → error page with no redirect; the connections page revokes the grant.

**Deviations**
- The "token rejected on `/mcp`" end-to-end assertion runs in M5, when `/mcp` exists. The audience check itself is unit tested here.
- Wasp's `apiNamespace` for `/.well-known` needed a distinct `middlewareConfigFn` name (see Environment notes).

## M5: MCP core and data tools

**Built**
- `src/mcp/defineTool.ts`: typed tool definitions (name, title, toolset, scope, description, raw-shape input and output, annotations, handler taking a Principal).
- `src/mcp/registry.ts`: collects the slices' tools; `toolsFor()` keeps core tools, requires each tool's scope on the principal, and lets `?toolsets=` narrow but never widen.
- `src/mcp/server.ts`: a fresh `McpServer` per request with name, version, and instructions. Each handler returns `structuredContent` (validated against the output schema) plus a compact JSON text block, turns `DomainError`s into actionable `isError` results, and logs `{ tool, userId, grantId, durationMs, ok }`.
- `src/mcp/handler.ts`: `POST /mcp`, stateless Streamable HTTP (no session ID), bearer auth with `WWW-Authenticate` discovery on 401; `GET`/`DELETE` return 405.
- Tools: `whoami` (core), `list_links`, `get_link`, `create_link`, `update_link`, `delete_link` (links), `get_link_stats`, `get_top_links` (analytics).
- `links.service.requestDeletion` decides for every surface: sessions and PATs delete immediately; OAuth grants with confirmation on get a `PendingAction` and a `confirmUrl`. REST `DELETE` uses it too (200 or 202).

**Tests**
- `src/mcp/server.test.ts` (SDK client over an in-memory transport): server info and instructions, tool schemas and annotations, create/list/stats/whoami with structured content, actionable errors, PAT delete vs. confirmation-required delete, scope and `?toolsets=` filtering.
- `src/mcp/parity.test.ts`: every Wasp operation (read from the `*.wasp.ts` files) maps to a tool or a `dashboard-only: <reason>`, and every tool is accounted for.
- `src/mcp/descriptions.test.ts`: titles, descriptions ≥ 60 chars, `.describe()` on every input field, enum values explained, read-only/destructive annotations, related tools mentioned.
- `e2e/mcp.integration.spec.ts` (live server, SDK Streamable HTTP client): list tools, create, click, stats, delete with a PAT; confirmation-required deletes over MCP and REST (202) for OAuth grants; 401 + discovery header, 405 for GET, `/api/v1`-audience token rejected on `/mcp`.
- `e2e/oauth.spec.ts` M5 step: the MCP SDK client's own OAuth flow runs headless (Playwright logs in and clicks Allow), then lists tools and calls `whoami` and `create_link`; its `/mcp` token is rejected by the REST API.

**Deviations**
- zod v4 doesn't carry a field's description through `.optional()`, so optional fields call `.describe()` again (caught by the description lint test).
- The SDK only sends CIMD `client_id`s that are https. The end-to-end test's local http test client returns its `client_id` from `clientInformation()` instead, which the SDK uses as-is.
- The integration test lives in `e2e/mcp.integration.spec.ts` (live server) rather than `src/mcp/integration.test.ts`, per the spec's build setup.
- Wasp bundles the server into one file with Rollup, so dynamic `import()` in server code breaks the build.
