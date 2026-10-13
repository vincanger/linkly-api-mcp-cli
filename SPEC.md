# Linkly — Implementation Spec

A Wasp app that shortens links and tracks clicks, built as a **teaching reference for a well-structured MCP server**. The product is deliberately simple so the architecture is the lesson: one service layer, exposed four ways (dashboard, REST API, MCP, and a CLI built on the REST API), with OAuth that works from any client.

> **For the coding agent:** Read this whole file before writing code. Build the milestones in order; each one must pass its acceptance criteria before starting the next. Where a Wasp or MCP SDK API detail here conflicts with the current official docs, **the docs win** — check https://wasp.sh/docs and the `@modelcontextprotocol/sdk` README for the installed versions, then note the deviation in `NOTES.md`.

---

## 1. Goals and principles

These map directly to the design guide the app is meant to teach.

| Principle | How Linkly implements it |
|---|---|
| MCP can do everything the dashboard can | Every feature lives in a slice `service.ts`; dashboard, REST, and MCP are thin adapters over it. A parity test enforces this. |
| Destructive actions are safe via deep links | `delete_link` either executes (with `destructiveHint`) or returns a confirmation URL, depending on the grant's `confirmDestructive` setting. |
| No codemode / lazy loading | Plain, fully described tools. No `execute_code`, no meta "list then load tools" pattern. |
| Search docs tool | `search_docs` + `read_doc` tools, plus docs exposed as MCP resources. |
| Deep link into product | `get_dashboard_url` tool, and every entity returned by any tool includes a `dashboardUrl`. |
| Toolsets / customization | Tools grouped into toolsets; the user picks toolsets on the OAuth consent screen, stored as scopes on the grant. Optional `?toolsets=` URL filter for clients that support it. |
| OAuth from any client | OAuth 2.1 + PKCE with Client ID Metadata Documents (CIMD). **No client allowlist.** |
| API spec is the baseline | Versioned REST API at `/api/v1` with a generated OpenAPI document, usable with personal access tokens. |
| Same tools, every surface | Dashboard, REST, and MCP are thin adapters over the services. The `linkly` CLI is a thin client over REST. The same operations are available everywhere, and parity tests enforce it. |
| Every surface says what's destructive | MCP uses `destructiveHint`, OpenAPI uses `x-destructive`, and the CLI requires `--yes`. A test checks that they agree. |

### Non-goals

Teams/orgs, billing, custom domains, geo-IP accuracy, rate limiting beyond a simple guard, embedding/semantic search for docs, MCP Apps, elicitation (except optional M12), and server-pushed notifications (see §13). Keep these out so the MCP structure stays visible.

---

## 2. Architecture: vertical slices

Code is organized **by feature, not by layer**. Each slice owns everything about its feature: schemas, business logic, Wasp operations, REST handlers, MCP tools, OpenAPI paths, UI, and tests.

### 2.1 The adapter rule

```
                ┌──────────────┐
  Dashboard ───▶│ operations.ts│──┐
                └──────────────┘  │
                ┌──────────────┐  │    ┌────────────┐     ┌────────┐
  REST API ────▶│   rest.ts    │──┼───▶│ service.ts │────▶│ Prisma │
                └──────────────┘  │    └────────────┘     └────────┘
                ┌──────────────┐  │
  MCP ─────────▶│    mcp.ts    │──┘
                └──────────────┘

  CLI (user's machine) ── HTTP + PAT ──▶ REST API
```

The CLI is the one surface that doesn't call `service.ts` directly. It runs on the user's machine and talks to the REST API like any other API client, which shows that "API → CLI" is only a change of execution environment.

Rules:

1. **All business logic and authorization lives in `service.ts`.** Adapters only parse input, build a `Principal`, call the service, and format output.
2. **Input/output shapes live in `schemas.ts`** as Zod schemas. The same schema validates Wasp operation args, REST bodies, and MCP tool input, and generates OpenAPI.
3. **Services never import from Wasp client code, Express, or the MCP SDK.** They take `(principal, input, deps)` and return plain objects or throw `DomainError`s.
4. **Slices may import from `src/shared/` and from another slice's `service.ts` or `schemas.ts` only.** Never from another slice's adapters or UI.

### 2.2 Directory layout

```
main.wasp.ts            # Wasp Spec: app config + joins each slice's spec (see §9)
schema.prisma
vite.config.ts          # wasp() + tailwindcss() plugins
components.json         # shadcn config (aliases rewritten to src/..., see 2.3)
src/
  Main.css              # @import "tailwindcss" + shadcn theme variables
  components/
    ui/                 # shadcn-generated components (button, table, dialog, ...)
  lib/
    utils.ts            # shadcn `cn()` helper
  shared/
    principal.ts        # Principal type + builders from Wasp session / bearer token
    scopes.ts           # Scope + toolset definitions (single source of truth)
    errors.ts           # DomainError + mappers to HttpError / HTTP / MCP results
    urls.ts             # serverUrl(), frontendUrl(), mcpResourceUrl()
    http.ts             # CORS + bearer-auth middleware for /api/v1, /mcp, /oauth
    pagination.ts       # cursor pagination helpers + schema
    zod.ts              # shared Zod setup (zod-to-openapi extension)
  links/
    links.wasp.ts       # this slice's pages, routes, operations, apis (every slice has one)
    schemas.ts
    service.ts
    service.test.ts
    operations.ts       # Wasp queries/actions
    rest.ts             # Wasp api handlers for /api/v1/links
    mcp.ts              # tool definitions for the "links" toolset
    openapi.ts          # registers paths with the OpenAPI registry
    ui/
      LinksPage.tsx
      LinkDetailPage.tsx
      LinkForm.tsx
  analytics/
    schemas.ts
    service.ts
    service.test.ts
    redirect.ts         # public GET /r/:slug → records click, 302s
    operations.ts
    rest.ts
    mcp.ts
    openapi.ts
    ui/StatsChart.tsx
  deeplinks/
    urls.ts             # pure URL builders for every dashboard view
    pendingActions.ts   # create/confirm/expire PendingAction records
    service.ts
    operations.ts
    mcp.ts              # get_dashboard_url
    ui/ConfirmActionPage.tsx
  docs/
    content.ts          # docs as data: [{ slug, title, tags, body }]
    service.ts          # search + read
    service.test.ts
    rest.ts
    mcp.ts              # search_docs, read_doc + docs:// resources
    openapi.ts
    ui/DocsPage.tsx
  tokens/               # personal access tokens (for REST / scripts)
    schemas.ts
    service.ts
    operations.ts
    ui/TokensPage.tsx
  oauth/
    metadata.ts         # /.well-known endpoints
    cimd.ts             # fetch + validate + cache client metadata documents
    authorize.ts        # validate request, issue codes (used by consent page actions)
    token.ts            # POST /oauth/token (auth code + refresh)
    revoke.ts           # POST /oauth/revoke
    grants.ts           # grant service (list/revoke connected apps)
    operations.ts
    cimd.test.ts
    token.test.ts
    ui/ConsentPage.tsx
    ui/ConnectionsPage.tsx
  mcp/
    defineTool.ts       # tool definition helper + types
    registry.ts         # collects tools from all slices, filters by scopes/toolsets
    server.ts           # builds an McpServer for a given principal
    handler.ts          # Wasp api handler for POST /mcp (stateless streamable HTTP)
    resources.ts        # collects resources (docs) from slices
    confirmations.ts    # optional M12: confirmation_required → URL-mode elicitation
    parity.test.ts
  discovery/            # optional M10: llms.txt, prerendered pages, /.well-known OpenAPI
    paths.ts
    llmsTxt.ts          # renders llms.txt from the docs slice and the API address
    vitePlugin.ts       # serves /llms.txt in dev, emits it into the client build
  openapi/
    registry.ts
    handler.ts          # GET /api/v1/openapi.json
  app/
    Layout.tsx
    LoginPage.tsx
    SignupPage.tsx
    HomePage.tsx
vitest.config.ts        # server-side unit tests (outside `wasp test`, see §10 build setup)
e2e/                    # Playwright end-to-end + integration tests (run against a live `wasp start`)
  playwright.config.ts
  fixtures/
    testClient.ts       # local server: serves the CIMD document + catches the redirect
    users.ts            # creates pre-verified users
  oauth.spec.ts
cli/                    # standalone npm package `linkly` (not part of the Wasp build), see §8
  package.json
  openapi.json          # committed snapshot of /api/v1/openapi.json
  src/
    api.ts              # typed client generated from openapi.json
    config.ts           # token + server URL resolution
    output.ts           # --json vs human tables, exit codes
    commands/           # one file per group: links.ts, stats.ts, docs.ts, auth.ts
  test/
```

`src/components/ui/` is shared UI infrastructure, not a feature slice. Any slice's `ui/` folder may import from it, and it never imports from a slice.

### 2.3 UI: shadcn/ui on Tailwind

All dashboard UI is built with **shadcn/ui** components on **Tailwind CSS v4**. Don't hand-roll a primitive that shadcn already provides: use its buttons, inputs, tables, dialogs, form controls, and so on.

**Setup** (follow https://wasp.sh/docs/guides/libraries/shadcn and https://wasp.sh/docs/guides/libraries/tailwind; the docs win if they differ from this):

1. **Tailwind:** `npm install tailwindcss` and `npm install -D @tailwindcss/vite`, add `tailwindcss()` next to `wasp()` in `vite.config.ts`, and put `@import "tailwindcss";` at the top of `src/Main.css`.
2. **Temporary `@` alias:** Wasp doesn't support the `@` import alias, but shadcn's preflight check requires one. Add `"compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } }` to the root `tsconfig.json`.
3. **Init shadcn:** `npx shadcn@latest init -b radix -p luma` (Radix base, Luma preset). This writes `components.json`, `src/lib/utils.ts`, and theme variables in `src/Main.css`.
4. **Remove the alias:** take the `compilerOptions` block back out of `tsconfig.json`.
5. **Fix `components.json` aliases:**
   ```json
   "aliases": {
     "components": "src/components",
     "utils": "src/lib/utils",
     "ui": "src/components/ui",
     "lib": "src/lib",
     "hooks": "src/hooks"
   }
   ```

**Adding components:** use `npx shadcn@latest add <name>`, then rewrite any `@/...` import in the generated files to a relative path (for example, `import { cn } from "@/lib/utils"` becomes `import { cn } from "../../lib/utils"`). Add components only when a page needs them. Expected set: `button`, `input`, `label`, `textarea`, `form`, `table`, `badge`, `card`, `dialog`, `alert-dialog`, `dropdown-menu`, `select`, `checkbox`, `switch`, `tabs`, `sonner` (toasts), `skeleton`, `chart`.

**Component mapping for the pages in this spec:**

| Page / element | shadcn components |
|---|---|
| `LinksPage` table, search, and tag filter | `table`, `input`, `select` or `badge` for tags, `button`, `dropdown-menu` for row actions |
| `LinkForm` (new/edit) | `form` (react-hook-form + the slice's Zod schema), `input`, `textarea`, `button` |
| Dashboard delete confirm | `alert-dialog` |
| `LinkDetailPage` edit/stats tabs | `tabs` (tab state in the URL `?tab=` so deep links work) |
| `StatsChart` | shadcn `chart` (wraps recharts) plus `select` for range and groupBy |
| `ConfirmActionPage` | `card`, `button` (no `alert-dialog`; the page itself is the confirmation) |
| `ConsentPage` | `card`, `checkbox` per scope (grouped by toolset), `switch` for "Require confirmation", `button` |
| `ConnectionsPage` / `TokensPage` | `table`, `switch`, `checkbox`, `dialog` (show the new PAT once, with copy), `alert-dialog` for revoke |
| Login / signup | wrap Wasp's auth UI in a `card`. Keep Wasp's auth forms and style them to match. |
| Feedback | `sonner` toasts for mutations, `skeleton` for loading states |

Forms reuse the slice's Zod schemas from `schemas.ts` through `@hookform/resolvers/zod`, so the dashboard validates the same shapes as REST and MCP do.

---

## 3. Shared kernel (`src/shared`)

### 3.1 Principal

Every service call takes a `Principal`, regardless of which adapter it came from.

```ts
export type Principal = {
  userId: string;
  scopes: Set<Scope>;
  source: "session" | "pat" | "oauth";
  grantId?: string;             // oauth only
  confirmDestructive: boolean;  // session: false; pat: false; oauth: from grant
};

export function principalFromSession(user: { id: string }): Principal; // all scopes
export function requireScope(p: Principal, scope: Scope): void;         // throws DomainError("forbidden")
```

Dashboard sessions get every scope, which is what guarantees "the MCP can do everything the dashboard can" is testable: same services, same scopes.

### 3.2 Scopes and toolsets (`scopes.ts`)

Single source of truth. The consent screen, token validation, MCP registry, and OpenAPI security docs all read from here.

```ts
export const SCOPES = {
  "links:read":     "View your links",
  "links:write":    "Create, edit, and delete your links",
  "analytics:read": "View click analytics",
} as const;
export type Scope = keyof typeof SCOPES;

export const TOOLSETS = {
  links:     { label: "Links",     scopes: ["links:read", "links:write"] },
  analytics: { label: "Analytics", scopes: ["analytics:read"] },
} as const;
export type Toolset = keyof typeof TOOLSETS;

// Always available regardless of toolset selection (no data access):
export const CORE_TOOLS = ["whoami", "search_docs", "read_doc", "get_dashboard_url"];
```

### 3.3 Errors (`errors.ts`)

```ts
export class DomainError extends Error {
  constructor(
    public code: "not_found" | "forbidden" | "conflict" | "invalid" | "unauthorized",
    message: string,
    public details?: unknown,
  ) { super(message); }
}
export function toWaspHttpError(e: unknown): never;          // → HttpError(404/403/409/400/401)
export function toHttpResponse(e: unknown, res: Response);   // → JSON { error: { code, message } }
export function toMcpToolError(e: unknown): CallToolResult;  // → { isError: true, content: [...] }
```

MCP error text must be actionable for an agent, e.g. `Link "abc" not found. Use list_links to find valid IDs.`

### 3.4 URLs (`urls.ts`)

Use Wasp's server `config` for `serverUrl` and `frontendUrl`. Define `mcpResourceUrl() = ${serverUrl}/mcp`. No hardcoded hosts anywhere else.

### 3.5 HTTP middleware (`http.ts`)

Configure via `apiNamespace` declarations:

- `/api/v1`, `/mcp`, `/oauth`, `/.well-known`: permissive CORS (any origin, `Authorization` and `Mcp-Protocol-Version` headers allowed, `WWW-Authenticate` exposed). Browser-based MCP clients need this.
- `bearerAuth(requiredFor: "api" | "mcp")`: reads `Authorization: Bearer <token>`, SHA-256 hashes it, looks it up in `AccessToken`, rejects if revoked or expired, updates `lastUsedAt` (throttled to once a minute), and attaches a `Principal` to `req`.
- On failure for `/mcp`, respond `401` with
  `WWW-Authenticate: Bearer resource_metadata="<serverUrl>/.well-known/oauth-protected-resource/mcp"`
  so clients can discover the auth server.

---

## 4. Data model (`schema.prisma`)

Use PostgreSQL (tags use a string array; analytics uses date truncation).

```prisma
model User {
  id           String        @id @default(uuid())
  links        Link[]
  grants       Grant[]
  accessTokens AccessToken[]
  pendingActions PendingAction[]
}

model Link {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  slug           String   @unique
  destinationUrl String
  title          String?
  tags           String[] @default([])
  archived       Boolean  @default(false)
  clicks         Click[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([userId, createdAt])
}

model Click {
  id        String   @id @default(uuid())
  linkId    String
  link      Link     @relation(fields: [linkId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  referrer  String?  // hostname only
  userAgent String?  // truncated to 200 chars
  @@index([linkId, createdAt])
}

// One row per "connected app" authorization. Tokens hang off it.
model Grant {
  id                 String   @id @default(uuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientId           String   // the CIMD URL
  clientName         String
  scopes             String[]
  confirmDestructive Boolean  @default(true)
  createdAt          DateTime @default(now())
  revokedAt          DateTime?
  accessTokens       AccessToken[]
  refreshTokens      RefreshToken[]
}

model AccessToken {
  id         String    @id @default(uuid())
  tokenHash  String    @unique
  kind       String    // "oauth" | "pat"
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  grantId    String?
  grant      Grant?    @relation(fields: [grantId], references: [id], onDelete: Cascade)
  name       String?   // PATs only
  scopes     String[]
  audience   String?   // oauth only: must equal mcpResourceUrl() or `${serverUrl}/api/v1`
  expiresAt  DateTime?
  revokedAt  DateTime?
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
}

model RefreshToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique
  grantId   String
  grant     Grant     @relation(fields: [grantId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  usedAt    DateTime? // rotation: single use
  createdAt DateTime  @default(now())
}

model AuthorizationCode {
  id            String    @id @default(uuid())
  codeHash      String    @unique
  userId        String
  clientId      String
  redirectUri   String
  codeChallenge String
  scopes        String[]
  resource      String
  confirmDestructive Boolean
  expiresAt     DateTime  // 60 seconds
  usedAt        DateTime?
}

model OAuthClientCache {
  clientId  String   @id  // CIMD URL
  metadata  Json
  fetchedAt DateTime
}

model PendingAction {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        String    // "delete_link"
  payload     Json      // { linkId, slug, destinationUrl } snapshot for display
  requestedBy String    // grant clientName or "api"
  expiresAt   DateTime  // 15 minutes
  completedAt DateTime?
  cancelledAt DateTime?
  createdAt   DateTime  @default(now())
}
```

Never store raw tokens or codes. Generate with `crypto.randomBytes(32).toString("base64url")`, store SHA-256 hex. Prefix raw tokens for recognizability: `lk_pat_`, `lk_at_`, `lk_rt_`.

---

## 5. Slices

Each slice below lists its service API, adapters, and UI. Service functions all have the signature `(principal, input, deps = { prisma })`.

### 5.1 `links`

**Schemas:** `LinkInput { destinationUrl (http/https URL), slug? (3–40 chars, [a-z0-9-]), title?, tags? (≤10, each ≤30 chars) }`, `LinkUpdate` (partial of LinkInput + `archived?`), `LinkListQuery { search?, tag?, archived? (default false), cursor?, limit? (1–100, default 25) }`, `LinkOut` (all fields + `shortUrl` + `dashboardUrl`).

**Service:**

| Function | Scope | Notes |
|---|---|---|
| `listLinks(p, query)` | `links:read` | Cursor-paginated, newest first. `search` matches slug, title, destination (case-insensitive). |
| `getLink(p, { id })` | `links:read` | Accepts ID **or slug** in `id` — agents often only know the slug. |
| `createLink(p, input)` | `links:write` | Auto-generate 7-char slug if absent; `conflict` on taken slug. |
| `updateLink(p, { id, ...patch })` | `links:write` | |
| `deleteLink(p, { id })` | `links:write` | Hard delete. See 5.3 for the confirmation flow; this function itself just deletes. |

Ownership: every lookup filters by `userId`. Return `not_found` (not `forbidden`) for other users' links.

`LinkOut.dashboardUrl` comes from `deeplinks/urls.ts`. This is how the deep-link principle leaks into every response.

**Wasp operations:** `getLinks`, `getLink`, `createLink`, `updateLink`, `deleteLink`. The dashboard delete calls `deleteLink` directly after an in-UI confirm dialog (the human is already in the product).

**REST:** `GET /api/v1/links`, `POST /api/v1/links`, `GET /api/v1/links/:id`, `PATCH /api/v1/links/:id`, `DELETE /api/v1/links/:id`.

**MCP tools (toolset `links`):**

| Tool | Scope | Annotations |
|---|---|---|
| `list_links` | `links:read` | `readOnlyHint: true` |
| `get_link` | `links:read` | `readOnlyHint: true` |
| `create_link` | `links:write` | `readOnlyHint: false` |
| `update_link` | `links:write` | `idempotentHint: true` |
| `delete_link` | `links:write` | `destructiveHint: true` |

`delete_link` behavior is defined in 5.3.

**UI:** `/links` (table with search, tag filter, create button), `/links/:id` (edit form, stats chart from analytics slice, delete button), `/links/new`.

### 5.2 `analytics`

**Redirect (`redirect.ts`):** Wasp `api` at `GET /r/:slug`, `auth: false`. Look up by slug; if missing or archived, 404 page. Otherwise insert a `Click` (referrer hostname, truncated UA) **without awaiting it on the response path**, then `302` to `destinationUrl`. Short URLs are `${serverUrl}/r/:slug`.

**Schemas:** `StatsQuery { linkId, range: "24h"|"7d"|"30d"|"90d", groupBy: "day"|"referrer" }`, `TopLinksQuery { range, limit? }`.

**Service:**

| Function | Scope | Returns |
|---|---|---|
| `getLinkStats(p, q)` | `analytics:read` + ownership | `{ total, series: [{ key, clicks }], dashboardUrl }` |
| `getTopLinks(p, q)` | `analytics:read` | `[{ link: LinkOut, clicks }]` |

Day series must include zero-click days so charts don't have gaps.

**REST:** `GET /api/v1/links/:id/stats`, `GET /api/v1/analytics/top-links`.

**MCP tools (toolset `analytics`):** `get_link_stats`, `get_top_links`, both `readOnlyHint: true`. Tool descriptions should say that the returned `dashboardUrl` opens an interactive chart and suggest sharing it with the user.

**UI:** `StatsChart.tsx` (shadcn `chart` over recharts: line chart for day, bar chart for referrer) used in `LinkDetailPage`. Range and groupBy are read from URL query params, so deep links can preselect them.

### 5.3 `deeplinks`

**`urls.ts` (pure functions, no I/O):**

```ts
export const dashboardUrls = {
  links:      (q?: { search?: string; tag?: string }) => string,
  link:       (id: string, q?: { tab?: "edit" | "stats"; range?: Range; groupBy?: GroupBy }) => string,
  newLink:    (prefill?: Partial<LinkInput>) => string,  // query params prefill the form
  topLinks:   (q?: { range?: Range }) => string,
  connections:() => string,
  tokens:     () => string,
  doc:        (slug: string) => string,
  confirm:    (actionId: string) => string,
};
```

The UI pages must actually honor every parameter these builders produce. Add a test that each builder's path matches a `route(...)` declared in the slices' `*.wasp.ts` files.

**Pending actions (`pendingActions.ts`):**

- `createPendingDeletion(p, { linkId })`: verifies ownership, snapshots the link, creates `PendingAction` with a 15-minute expiry, returns `{ actionId, confirmUrl }`.
- `confirmPendingAction(sessionPrincipal, { actionId })`: must be the same user, not expired, not completed/cancelled; then calls `links.service.deleteLink`.
- `cancelPendingAction(...)`.

**`delete_link` tool behavior:**

```
if principal.confirmDestructive:
    create pending deletion
    return {
      status: "confirmation_required",
      confirmUrl,
      message: "Deletion needs confirmation. Share this link with the user; the link will be deleted when they confirm in Linkly. Expires in 15 minutes."
    }
else:
    delete immediately
    return { status: "deleted", id, slug }
```

`confirmDestructive` is chosen by the user on the consent screen (default on) and is editable later on the connections page. This teaches both patterns in one tool.

**The same rule on every surface.** The decision lives in one service function, `links.service.requestDeletion(p, { id })`, which returns either `{ status: "deleted", id, slug }` or `{ status: "confirmation_required", confirmUrl, actionId, expiresAt, message }` based on `p.confirmDestructive`. Every adapter calls it:

| Caller | `confirmDestructive` | Result |
|---|---|---|
| Dashboard session | always `false` (the in-UI dialog is the confirmation) | deleted |
| PAT (REST, MCP, or CLI) | always `false` | deleted |
| OAuth token, grant has confirmation on | `true` | confirmation required on **both** MCP and REST |
| OAuth token, grant has confirmation off | `false` | deleted |

`PendingAction.requestedBy` is the grant's `clientName` on both MCP and REST.

**MCP tool (core, always on):** `get_dashboard_url({ view, id?, params? })`, `readOnlyHint: true`. `view` is an enum mirroring `dashboardUrls` keys (excluding `confirm`). Description: "Use this when the user wants to see, visualize, or manually edit something in Linkly."

**UI:** `/confirm/:actionId` shows what will happen (link slug, destination, requesting app name), with Confirm and Cancel buttons. Handles expired and already-completed states.

### 5.4 `docs`

**`content.ts`:** 6–10 short docs as a typed array (keeps bundling trivial). Suggested set: `getting-started`, `links-and-slugs`, `tags`, `how-clicks-are-counted`, `analytics-ranges`, `connecting-ai-clients`, `toolsets-and-permissions`, `deleting-links`, `rest-api`, `cli`.

**Service:** `searchDocs({ query, limit? })` returns `[{ slug, title, snippet, score, url }]` via simple scoring (title match ×3, tag match ×2, body term frequency). `readDoc({ slug })` returns full markdown. No auth required.

**REST:** `GET /api/v1/docs/search?q=`, `GET /api/v1/docs/:slug` (public).

**MCP (core, always on):**

- Tools: `search_docs`, `read_doc`, both `readOnlyHint: true`. The `search_docs` description should tell agents to use it when unsure how a Linkly concept works before calling other tools.
- Resources: each doc is also registered as `docs://linkly/<slug>` (`text/markdown`), so clients that surface resources get them too.

**UI:** `/docs` index and `/docs/:slug` rendered markdown.

### 5.5 `tokens` (personal access tokens)

The "just ship your API spec" baseline: users can script against REST without OAuth.

- Service: `createPat(p, { name, scopes, expiresInDays? })` returns the raw token **once**; `listPats`, `revokePat`.
- Session principal only (PATs cannot mint PATs).
- UI `/settings/tokens`: create (name, scope checkboxes), list with last used, revoke.
- PAT tokens have `audience: null` and are accepted on `/api/v1` **and** `/mcp` (useful for clients configured with a static header).

### 5.6 `oauth`

Implements the MCP authorization spec: Linkly's server is both the **resource server** (`/mcp`, `/api/v1`) and the **authorization server**.

**Endpoints**

| Endpoint | Type | Purpose |
|---|---|---|
| `GET /.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp` | Wasp api | RFC 9728 metadata: `{ resource: mcpResourceUrl(), authorization_servers: [serverUrl], scopes_supported, bearer_methods_supported: ["header"] }` |
| `GET /.well-known/oauth-authorization-server` | Wasp api | RFC 8414 metadata (below) |
| `/oauth/authorize` | **Wasp page** (frontend) | Consent UI; reuses Wasp auth login |
| `POST /oauth/token` | Wasp api | `authorization_code` and `refresh_token` grants |
| `POST /oauth/revoke` | Wasp api | RFC 7009 |

Authorization server metadata:

```json
{
  "issuer": "<serverUrl>",
  "authorization_endpoint": "<frontendUrl>/oauth/authorize",
  "token_endpoint": "<serverUrl>/oauth/token",
  "revocation_endpoint": "<serverUrl>/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["links:read", "links:write", "analytics:read"],
  "client_id_metadata_document_supported": true
}
```

The authorization endpoint lives on the frontend origin because it's a Wasp page. That's allowed; document it in `NOTES.md` since learners will ask.

**CIMD (`cimd.ts`)**

The `client_id` is an HTTPS URL pointing to a JSON document describing the client. On an authorize request:

1. Require `client_id` to be an `https://` URL with a path (allow `http://localhost` only in the local-dev exception below).
2. Check `OAuthClientCache`; refetch if older than 24h.
3. Fetch with SSRF guards: resolve DNS and reject private, loopback, and link-local addresses; 5s timeout; 64 KB max body; no redirects; `Accept: application/json`.

   **Local-dev exception:** when `NODE_ENV` is `development` or `test`, allow `http://` client IDs whose host is exactly `localhost`, `127.0.0.1`, or `[::1]`, and let the fetch reach those loopback addresses. This is how the end-to-end test (and a developer running a local client) serves a metadata document from the same machine. Everything else stays blocked in every environment: other private ranges (`10.*`, `192.168.*`, and so on), link-local addresses including `169.254.169.254`, and hostnames that only *resolve* to loopback. The timeout, size limit, and no-redirect rules also still apply. Put the check in one function, `isAllowedLoopbackClient(url)`, so it's easy to audit.
4. Validate: document's `client_id` must exactly equal the URL; `redirect_uris` is a non-empty array; `client_name` present (fall back to the hostname).
5. `redirect_uri` in the request must exactly match one in the document. **Exception:** loopback redirects (`http://127.0.0.1:*` or `http://localhost:*`) match regardless of port, per RFC 8252.

**There is no client allowlist or blocklist.** Any client that publishes a valid metadata document can connect. The consent screen is the security boundary: it shows the client name and the **hostname of the `client_id` URL** prominently, with a note that Linkly hasn't verified the app.

Dynamic Client Registration (RFC 7591) is not part of the core build. See optional milestone M11.

**Authorize flow (`authorize.ts` + `ConsentPage.tsx`)**

1. Page reads query params: `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`, `state`, `scope?`, `resource?`.
2. If not logged in, redirect to login and return afterward (preserve the full query string).
3. Call Wasp query `validateAuthorizeRequest(params)`, which runs CIMD validation and returns `{ clientName, clientHost, requestedScopes }`. On an invalid `client_id` or `redirect_uri`, show an error page and **never redirect**. On other errors, redirect back with `error=`.
4. `resource`, if present, must be `mcpResourceUrl()` or `${serverUrl}/api/v1`; default to `mcpResourceUrl()`.
5. Consent UI: one checkbox per requested scope, grouped by toolset (default: all requested scopes checked; if no `scope` was requested, all scopes). Ticking a `:write` scope ticks its `:read` scope, and unticking read unticks write. Then a "Require confirmation for destructive actions" toggle (default on), and Allow / Deny buttons.
6. Wasp action `approveAuthorization(...)` creates an `AuthorizationCode` (60s expiry, stores the chosen scopes capped at the requested ones, the requested scopes, `confirmDestructive`, `resource`, PKCE challenge) and returns the redirect URL `redirect_uri?code=...&state=...&iss=...`. The page sets `window.location`.

**Token endpoint (`token.ts`)**

- `authorization_code`: verify code hash, not used, not expired, `client_id` and `redirect_uri` match, PKCE S256 verifier matches. Mark used. Reusing a code revokes the grant it created. Create or reuse a `Grant` (one per user + clientId; update scopes and requested scopes on re-consent). Issue an access token (1h, `audience = resource`) and a refresh token (30d).
- `refresh_token`: single-use rotation. Reusing a used refresh token revokes the whole grant.
- Response: `{ access_token, token_type: "Bearer", expires_in, refresh_token, scope }`.
- Accept `application/x-www-form-urlencoded`. Errors use RFC 6749 shape: `{ error, error_description }`.

**Audience check:** `bearerAuth("mcp")` rejects OAuth tokens whose `audience` isn't `mcpResourceUrl()`; `bearerAuth("api")` requires `${serverUrl}/api/v1`. PATs skip this check.

**Where OAuth permissions come from:** for an OAuth token, `bearerAuth` builds the principal's `scopes` and `confirmDestructive` from the token's **Grant** at request time, and rejects the token if the grant is revoked. `AccessToken.scopes` only records what was issued, for display and audit. That's what makes edits on the connections page apply to existing tokens immediately.

**Connections UI (`/settings/connections`):** list grants (client name, client host, scopes, confirm-destructive toggle, created, last used), edit scopes (only within the scopes the app requested) and the toggle, revoke. Changes apply to existing tokens immediately because the principal is built from the grant at request time.

---

## 6. MCP server (`src/mcp`)

### 6.1 Transport

- Single Wasp `api` at `POST /mcp` (plus `GET` and `DELETE` returning `405`), `auth: false`, protected by `bearerAuth("mcp")` middleware.
- **Stateless** Streamable HTTP (optional M12 moves this to the v2 SDK's `createMcpHandler`): for each request, build a fresh `McpServer` for the request's principal and a `StreamableHTTPServerTransport` with no session ID generator, handle the request, then close both on response close. No in-memory sessions, so it scales horizontally and there's nothing to explain about session affinity.
- Server info: `{ name: "linkly", version: <package version> }`. Set `instructions` to a short paragraph: what Linkly is, "use `search_docs` when unsure," "use `get_dashboard_url` to show the user charts," and "deletions may return a confirmation link you should share."

### 6.2 `defineTool`

Every slice declares tools the same way:

```ts
export type ToolDef<I extends z.ZodRawShape, O extends z.ZodRawShape> = {
  name: string;                 // snake_case, verb_noun
  title: string;                // human label
  toolset: Toolset | "core";
  scope?: Scope;                // required unless core
  description: string;          // what, when to use, what it returns, related tools
  input: I;
  output?: O;                   // → outputSchema + structuredContent
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  handler: (principal: Principal, input: z.infer<z.ZodObject<I>>) => Promise<z.infer<z.ZodObject<O>>>;
};
export function defineTool<I, O>(def: ToolDef<I, O>): ToolDef<I, O>;
```

The registry wraps each handler to:

1. Call the service.
2. Return both `structuredContent` (validated against `output`) and a `content` text block containing a compact JSON rendering.
3. Convert `DomainError`s with `toMcpToolError`.
4. Log `{ tool, userId, grantId, durationMs, ok }`.

Description conventions (enforced by a lint-style test): at least 1 sentence of purpose, mentions related tools by name where relevant, every input field has `.describe()`, and enum values are explained.

### 6.3 Registry and filtering (`registry.ts`)

```ts
const allTools = [...linksTools, ...analyticsTools, ...docsTools, ...deeplinkTools, whoamiTool];

export function toolsFor(principal: Principal, requestedToolsets?: Toolset[]): ToolDef[] {
  // 1. core tools always included
  // 2. tool.scope must be in principal.scopes
  // 3. if ?toolsets= provided, tool.toolset must be in it (can only narrow, never widen)
}
```

`?toolsets=links,analytics` on the MCP URL is optional, for clients that let users edit the URL. Token scopes are the real enforcement, so clients without tool-selection UI still get the right set.

The `whoami` tool (core) returns `{ userId, username, scopes, toolsets, confirmDestructive, dashboardUrl }`, which is useful for agents to self-orient.

### 6.4 Tool inventory (final)

| Tool | Toolset | Scope |
|---|---|---|
| `whoami` | core | — |
| `search_docs` | core | — |
| `read_doc` | core | — |
| `get_dashboard_url` | core | — |
| `list_links` | links | links:read |
| `get_link` | links | links:read |
| `create_link` | links | links:write |
| `update_link` | links | links:write |
| `delete_link` | links | links:write |
| `get_link_stats` | analytics | analytics:read |
| `get_top_links` | analytics | analytics:read |

---

## 7. REST API and OpenAPI

- All REST handlers live in slice `rest.ts` files.
- Responses: resource JSON directly; lists are `{ data: [...], nextCursor }`; errors are `{ error: { code, message } }`.
- Declared with `api(...)` entries in each slice's `*.wasp.ts`, under the `/api/v1` `apiNamespace`.
- Each slice's `openapi.ts` registers its paths using `@asteasolutions/zod-to-openapi` and the slice's Zod schemas. `src/openapi/handler.ts` assembles the document (OpenAPI 3.1) and serves it at `GET /api/v1/openapi.json` (public).
- Security schemes: `bearer` (PAT) and `oauth2` (authorization code + PKCE, pointing at the endpoints above) with per-operation scopes.
- **`x-destructive`:** every operation declares `x-destructive: true | false` (only `DELETE /api/v1/links/:id` is `true`). This gives REST clients and agents the same safety information the MCP `destructiveHint` gives. A test asserts that each operation's `x-destructive` matches the `destructiveHint` of the MCP tool it maps to.
- **`DELETE /api/v1/links/:id`:** returns `200` with `{ status: "deleted", id, slug }`, or `202 Accepted` with `{ status: "confirmation_required", confirmUrl, actionId, expiresAt, message }` when the caller's grant requires confirmation (see 5.3). Document both responses in OpenAPI.
- **`GET /api/v1/me`:** returns the same shape as the `whoami` tool, so the CLI and scripts can check their token.
- Link the OpenAPI URL from the `rest-api` doc and the tokens page.

---

## 8. CLI (`cli/`)

A small `linkly` command-line tool that turns the REST API into commands. It exists to show the same tools on a fourth surface, and to follow the rules that make a CLI safe for agents to run.

### 8.1 Shape

- Standalone TypeScript package in `cli/`, named `linkly`, with its own `package.json` and a single binary. It isn't published to npm. Run it with `npm link` or `node cli/dist/index.js`. Use `commander` for argument parsing. Keep other dependencies minimal.
- **It only talks to REST.** It must not import anything from `src/`. Its client types are generated from `cli/openapi.json` with `openapi-typescript` and called through `openapi-fetch`. `npm run gen` refreshes the snapshot from a running server.
- **Auth:** personal access tokens only (no OAuth in the CLI). The token is resolved from `--token`, then `LINKLY_TOKEN`, then `~/.config/linkly/config.json` (file mode `0600`). The server URL is resolved from `--url`, then `LINKLY_URL`, then the config file.

### 8.2 Commands

Commands mirror the MCP tools one to one:

| Command | REST call | MCP tool |
|---|---|---|
| `linkly whoami` | `GET /me` | `whoami` |
| `linkly links list [--search] [--tag] [--archived] [--limit] [--cursor] [--all]` | `GET /links` | `list_links` |
| `linkly links get <id-or-slug>` | `GET /links/:id` | `get_link` |
| `linkly links create <url> [--slug] [--title] [--tag ...]` | `POST /links` | `create_link` |
| `linkly links update <id> [--destination] [--slug] [--title] [--tag ...] [--archived]` | `PATCH /links/:id` | `update_link` |
| `linkly links delete <id> --yes` | `DELETE /links/:id` | `delete_link` |
| `linkly stats <id> [--range] [--group-by]` | `GET /links/:id/stats` | `get_link_stats` |
| `linkly top-links [--range] [--limit]` | `GET /analytics/top-links` | `get_top_links` |
| `linkly docs search <query>` | `GET /docs/search` | `search_docs` |
| `linkly docs read <slug>` | `GET /docs/:slug` | `read_doc` |
| `linkly auth login --token <pat>` / `--token-stdin` | `GET /me` (to verify) | none |
| `linkly auth logout` | none | none |

`get_dashboard_url` has no command. Every JSON result already includes `dashboardUrl`, and the human output prints it.

With a PAT, `links delete --yes` always deletes immediately. If the server ever answers `202` (an OAuth-style token passed with `--token`), the CLI prints the `confirmUrl` and exits `0`. It never waits or polls.

### 8.3 Agent-safe rules

These are acceptance criteria, not suggestions:

1. **Never prompt.** No interactive input, pagers, spinners, or confirmations, ever. If input is missing, exit with a usage error that says exactly which flag to add. `auth login` without `--token` or `--token-stdin` fails and points to `/settings/tokens`.
2. **Destructive commands need `--yes`.** `links delete` without it exits with code 2 and the message: `Refusing to delete without --yes. Re-run: linkly links delete <id> --yes`.
3. **Machine output.** `--json` prints exactly the REST response body to stdout. JSON is also the default when stdout isn't a TTY. Human mode prints compact tables built from the same data.
4. **Errors go to stderr** (as `{ error: { code, message } }` in JSON mode). Exit codes: `0` ok, `1` unexpected, `2` usage, `3` unauthorized, `4` forbidden, `5` not found, `6` conflict.
5. **Good `--help`.** Every command has a one-line purpose, flag descriptions, and at least one example. Reuse the wording of the matching MCP tool description where it fits.
6. **No hidden state** other than the config file. There is no cache and no background process.

---

## 9. `main.wasp.ts` outline

Linkly uses the **Wasp Spec** (`main.wasp.ts`, docs: https://wasp.sh/docs/general/spec), not the `main.wasp` DSL. Each slice keeps its own `<slice>.wasp.ts` that exports a `Spec`, which fits the vertical-slice layout, and `main.wasp.ts` only joins them. Illustrative: check the `@wasp.sh/spec` API reference for exact function signatures, and run `wasp install` after creating the project.

```ts
// main.wasp.ts
import { app, apiNamespace } from "@wasp.sh/spec";
import { Layout } from "./src/app/Layout" with { type: "ref" };
import { restMiddleware, mcpMiddleware, oauthMiddleware } from "./src/shared/http" with { type: "ref" };
import { appSpec } from "./src/app/app.wasp";
import { linksSpec } from "./src/links/links.wasp";
import { analyticsSpec } from "./src/analytics/analytics.wasp";
// ...one import per slice

export default app({
  name: "linkly",
  wasp: { version: "^0.25" },       // set to the installed version
  title: "Linkly",
  auth: {
    userEntity: "User",
    methods: { usernameAndPassword: {} }, // no email sender needed to deploy
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/links",
  },
  client: { rootComponent: Layout },
  spec: [
    apiNamespace(restMiddleware,  { path: "/api/v1" }),
    apiNamespace(mcpMiddleware,   { path: "/mcp" }),
    apiNamespace(oauthMiddleware, { path: "/oauth" }),
    apiNamespace(oauthMiddleware, { path: "/.well-known" }),
    appSpec,
    linksSpec,
    analyticsSpec,
    // ...one entry per slice
  ],
});
```

```ts
// src/links/links.wasp.ts
import { page, route, query, action, api, type Spec } from "@wasp.sh/spec";
import { LinksPage } from "./ui/LinksPage" with { type: "ref" };
import { getLinks, createLink } from "./operations" with { type: "ref" };
import { listLinksHandler } from "./rest" with { type: "ref" };

export const linksSpec: Spec = [
  route("LinksRoute", "/links", page(LinksPage, { authRequired: true })),
  query(getLinks, { entities: ["Link"] }),
  action(createLink, { entities: ["Link"] }),
  api(listLinksHandler, { httpRoute: ["GET", "/api/v1/links"], entities: ["Link", "AccessToken"], auth: false }),
  // ...
];
```

---

## 10. Milestones

Build in this order. Each milestone ends with passing tests and a short entry in `NOTES.md` describing what was built and any deviations from this spec.

### Build setup

- **Where:** scaffold the Wasp app in the same folder as this spec (with `wasp new`, then `wasp install`). Run `git init` before M0, and make one commit per milestone once its acceptance criteria pass, with a message like `M3: REST API, PATs, and OpenAPI`.
- **Database:** Postgres through `wasp db start` (Docker). The automated tests use a separate database (`linkly_test`) selected with `DATABASE_URL`, and reset it before each run.
- **Autonomous build:** the build runs start to finish with no human. Every acceptance criterion that says "in the browser" or "manually" is checked with a Playwright test instead, except the items in the §11 manual checklist.
- **Manual checks don't block.** The MCP Inspector check (M4) and the real-client check (M5) can't be automated. Record them in `NOTES.md` under **"Manual checks still to do"** with exact steps, and continue. The Playwright end-to-end tests cover the same flows.
- **Blocked?** If something can't be resolved from this spec or the official docs, pick the most conservative option, record it in `NOTES.md` under **"Decisions made without the author"**, and continue.

**M0: Scaffold and shared kernel.** New Wasp app with username-and-password auth, Postgres, Tailwind v4, shadcn/ui (set up per 2.3), and Vitest. Implement `src/shared/*`, the Prisma schema, and the layout, login, and signup pages, all built with shadcn components.
*Accept:* app runs, a user can sign up and log in, `errors.ts` and `principal.ts` have unit tests, the `tsconfig.json` has no `@` alias left in it, and `grep -r '"@/' src/` finds nothing.

**M1: Links slice (dashboard only).** Service, operations, UI.
*Accept:* CRUD works in the browser, service tests cover ownership (a user can't read or modify another user's link), slug conflict, and ID-or-slug lookup.

**M2: Redirect and analytics.** `/r/:slug`, click recording, stats service, chart.
*Accept:* visiting a short URL redirects and records a click, the chart shows zero-filled days, and range/groupBy come from URL params.

**M3: REST API, PATs, and OpenAPI.** Tokens slice, bearer middleware, REST handlers for links, analytics, and docs, plus the OpenAPI endpoint.
*Accept:* `curl` with a PAT can do full CRUD, missing scope returns 403, `GET /api/v1/me` works, `openapi.json` validates (use `@apidevtools/swagger-parser` in a test), and every operation has `x-destructive`.

**M4: OAuth with CIMD.** Metadata endpoints, consent page, token/refresh/revoke, grants, connections page.
*Accept:*
- **Unit tests** cover PKCE failure, code reuse, refresh rotation and reuse detection, CIMD `client_id` mismatch, redirect mismatch, loopback port flexibility, and SSRF rejection of `http://169.254.169.254`. They also cover the local-dev exception: `http://localhost:<port>/client.json` is accepted in `test`, rejected when `NODE_ENV=production`, and `http://10.0.0.5/...` and a hostname that resolves to `127.0.0.1` are rejected in every environment.
- **The Playwright end-to-end OAuth test** (`e2e/oauth.spec.ts`, see §11) passes headless with no human input.
- **Manual check (non-blocking):** the MCP Inspector OAuth flow, recorded in `NOTES.md` under "Manual checks still to do".

**M5: MCP core and data tools.** `defineTool`, registry, server, handler, `whoami`, links and analytics tools.
*Accept:* the integration test (below) passes, the end-to-end OAuth test's M5 steps pass (the MCP SDK client completes OAuth headless and calls tools), and connecting Claude (or another real MCP client) via OAuth is recorded as a non-blocking manual check in `NOTES.md`.

**M6: Docs.** Content, service, REST, tools, resources, UI.
*Accept:* `search_docs("how are clicks counted")` returns `how-clicks-are-counted` first, and resources are listed by the MCP client.

**M7: Deep links and confirmations.** URL builders, `get_dashboard_url`, `dashboardUrl` on all outputs, pending actions, confirm page, `delete_link` dual behavior.
*Accept:* with `confirmDestructive` on, `delete_link` returns a working confirm URL, and confirming as the same user deletes the link. Confirming as a different user, after expiry, or twice fails gracefully. With it off, deletion is immediate, and the end-to-end OAuth test's M7 steps pass.

**M8: Toolsets polish.** Toolset selection on consent, editable on the connections page, `?toolsets=` filter.
*Accept:* a grant with only `analytics` sees core + analytics tools only, `?toolsets=` can narrow but never widen, and editing a grant changes the tool list on the next request, and the end-to-end OAuth test's M8 steps pass.

**M9: CLI and final docs.** The `cli/` package per §8, a `cli` doc page, and the finished `README.md` and `docs/ARCHITECTURE.md`, including every section listed in §12.
*Accept:* the CLI test (below) passes, every rule in 8.3 is covered by a test, `linkly links list --json | jq` works against the dev server, and the snapshot drift test passes.

### Optional milestones

Build these only after M0–M9 pass. They don't depend on each other. Each one gets its own `NOTES.md` entry like the core milestones.

**M10: Agent discovery.** Lets an agent that's only told "use linkly.example.com" (the dashboard's address) find out how to connect, then do it: MCP if it supports MCP, otherwise the REST API with OAuth or a personal access token. The only human step left is the one that has to stay: approving on the consent screen, or creating a token. It builds on CIMD OAuth (M4) and adds an entry point on the dashboard's site, with the OpenAPI document also at a `/.well-known` path as a backup.

> **Conventions, not standards.** `llms.txt` is a convention ([llmstxt.org](https://llmstxt.org)) that some agents check. OpenAPI discovery at `/.well-known` is a proposal with no agreed path yet, and few clients look for it. Before building, check for a current proposal and follow it if one exists. Otherwise use the paths below. Either way, keep each path in a single constant in `src/discovery/paths.ts` and record the choices in `NOTES.md`.

> **Two sites.** Wasp serves the dashboard (static files) and the API server from different addresses. Agents start from the dashboard's address, so what they read first has to be there. Today every dashboard route returns the same empty page shell until JavaScript runs, so fetching the homepage shows an agent nothing.

New slice `src/discovery/`. It adds metadata and build output only: no new business logic and no new data.

1. **`llms.txt` on the dashboard, generated at build time.**
   - **Generator:** a pure function, `renderLlmsTxt({ serverUrl })` in `src/discovery/llmsTxt.ts`, built from the docs slice. It must not import `wasp/*`, like everything the unit tests import.
   - **Build hook:** a Vite plugin in `vite.config.ts` serves `/llms.txt` from the dev server and emits it into the client build. It then runs in every `wasp start`, `wasp build`, and deploy, with no step to remember. It reads the API address from `REACT_APP_API_URL`, which Wasp's client build already requires. Links to the API are absolute. Links to dashboard pages are root-relative (`/settings/tokens`), because they're on the same site as the file.
   - **Content, in the llmstxt.org format, in this order:**
     1. What Linkly is, in one paragraph.
     2. **MCP (recommended):** the `/mcp` URL. Login is OAuth in the browser, where the user picks what the agent may do. Deletions may return a confirmation link to share with the user.
     3. **REST:** the base URL and the OpenAPI URL. OAuth clients follow the `401` to log in. Any other agent asks the user for a personal access token from `/settings/tokens`, with the scopes the task needs.
     4. **Rules:** never ask the user for their Linkly password. Ask the user before any operation marked `x-destructive: true`.
     5. Links to every doc (the prerendered pages from item 2).
   - **Only what the OpenAPI document can't say:** which way to connect, the token fallback, and the rules. Endpoints, the scope each one needs, `x-destructive` flags, and the login details (CIMD, PKCE, `resource`) are already in the OpenAPI document, so `llms.txt` links to it instead of repeating them.
   - **Why build time, not a server route:** every input is fixed per deploy, and the file then lives on the dashboard's own site with no proxy or rewrite. Only content that changes without a deploy would need a server route.

2. **Real HTML where agents land.**
   - **Prerender** the homepage (`route("HomeRoute", "/", page(HomePage), { prerender: true })`), the docs index, and every doc page (`prerender` on `DocRoute`, one path per slug in `src/docs/content.ts`). The prerendered homepage is the logged-out view.
   - **Make those pages safe to prerender.** `DocsPage` reads `window.location.origin` while rendering (`src/docs/ui/DocsPage.tsx`), and there's no `window` at build time. Fall back to root-relative links when there's no `window`.
   - **A visible "For AI agents" section on the homepage,** with the MCP URL and the `llms.txt` URL. Visible text survives whatever HTML-to-text conversion an agent's fetch tool does, and people can copy it.
   - Add `<link rel="alternate" type="text/markdown" href="/llms.txt">` to `head` in `main.wasp.ts`. It's cheap, but don't rely on it.
   - With the docs prerendered, the `resource_documentation` link in the protected-resource metadata (already `/docs/<slug>`) becomes readable too.

3. **"Connect an AI agent" on the Connections page.** A card with copy buttons for the MCP URL and a ready prompt: "Read `<dashboard>/llms.txt` and connect to my Linkly account." A URL the user hands over is the most reliable signal, because nothing depends on the agent guessing. Build the URLs at runtime from `config.apiUrl` and `window.location.origin`.

4. **Signals on the API server, for code rather than models.**
   - Already built in M4, keep as is: `401` with `WWW-Authenticate: Bearer resource_metadata="..."` on `/api/v1`, and `/.well-known/oauth-protected-resource/api/v1`.
   - Add a `Link: </api/v1/openapi.json>; rel="service-desc"` header (RFC 8631) to `/api/v1` responses. `service-desc` means "machine-readable API description", so it points at the OpenAPI document, never at `llms.txt`.
   - Serve the OpenAPI document at `GET /.well-known/openapi.json` too, for agents that look there first: the same handler as `/api/v1/openapi.json`, not a copy.
   - **As built:** also `GET /.well-known/api-catalog` (RFC 9727), the registered well-known path for API discovery: a linkset pointing at the OpenAPI document, the REST docs page, and `llms.txt`.
   - **No `SKILL.md`.** A skill only adds value over `llms.txt` when agents install it, and skill installers install from git repos, not from a `/.well-known` URL. An installable skill for the `linkly` CLI would be its own milestone.

5. **Docs.** Add a "Discovery without MCP" section to `docs/ARCHITECTURE.md`. It covers:
   - the path from the dashboard address to an API call;
   - why `llms.txt` is built ahead of time and pages are prerendered (two sites, empty page shell);
   - what an agent on REST misses compared with MCP (tool annotations that clients act on, tool descriptions written for the model);
   - serving the dashboard and API from one domain in production (a reverse proxy) as the recommended setup, while `llms.txt` works either way.

*Accept:*
- **An end-to-end test (`e2e/discovery.spec.ts`) acts as an agent that's only given the dashboard address. It uses `fetch`, plus Playwright for the consent click:**
  1. `GET <dashboard>/` without running JavaScript: the HTML contains the "For AI agents" text and the `llms.txt` URL.
  2. `GET <dashboard>/llms.txt`, and read the MCP URL and the OpenAPI URL from it.
  3. Fetch the OpenAPI document and pick the list-links operation out of it.
  4. Call it without a token: `401` with the `WWW-Authenticate` header. Follow it to the protected-resource metadata, then to the authorization-server metadata.
  5. Complete OAuth with the CIMD test client fixture from M4, using `resource=<server>/api/v1`, then call list-links successfully.

  The test asserts that no request touched `/mcp`. If `wasp start` doesn't prerender (only `wasp build` does), check step 1 against a built client instead, and note how in `NOTES.md`.
- **Unit test:** `llms.txt` contains the MCP URL, the OpenAPI URL, every doc slug, the token page, and both rules.
- **Build check:** a client build with a given `REACT_APP_API_URL` outputs an `llms.txt` containing that address, and prerendered HTML for `/` and every doc page that contains the page's text.
- The OpenAPI document served at `/.well-known/openapi.json` still passes validation, and `/api/v1` responses carry the `service-desc` header.

**M11: Dynamic Client Registration fallback.** Supports older MCP clients that don't know CIMD and expect to register first (RFC 7591).

- **Isolated and off by default.** Build it in its own file, `src/oauth/dcr.ts`, behind an `OAUTH_DCR_ENABLED` flag (default `false`). With the flag off, the endpoint returns `404` and the authorization-server metadata doesn't mention it.
- **Endpoint:** `POST /oauth/register` accepts `client_name`, `redirect_uris`, and optionally `client_uri`, `logo_uri`, and `scope`. It returns a generated `client_id` (not a URL), with `token_endpoint_auth_method: "none"` (public clients only, PKCE required as usual).
- **Storage:** a new `RegisteredClient` model (`clientId`, `clientName`, `redirectUris`, `createdAt`). `cimd.ts` gets a small resolver: if `client_id` is an `https://` URL, use CIMD. Otherwise, look it up in `RegisteredClient`. Every other part of the authorize and token flow stays the same.
- **Metadata:** when enabled, add `registration_endpoint` to the authorization-server metadata.
- **Same validation rules as CIMD:** redirect URIs must be `https://` or loopback, and the loopback port rule applies.
- **The consent screen marks these clients:** it shows "self-registered app" instead of a `client_id` host, since there's no domain to show.
- **Docs:** a short `ARCHITECTURE.md` note on why CIMD is the default and DCR is only a fallback: registration creates unbounded client rows and proves nothing about who the client is.

*Accept:*
- Unit tests cover registration validation (reject a non-HTTPS, non-loopback redirect, reject an empty `redirect_uris`), the `404` when disabled, and the metadata including `registration_endpoint` only when enabled.
- The end-to-end OAuth test runs once more with a DCR-registered client instead of the CIMD fixture, and passes.

**M12: Confirm deletions with URL-mode elicitation.** Moves the MCP server to the 2026-07-28 revision, so a client that supports URL-mode elicitation opens the confirmation page itself instead of the agent passing the link along. The page, the pending deletion, and the rule that only the user can confirm, in their own dashboard session, stay as built in M7. Every other client, and REST, keeps getting `confirmUrl` in the result.

> **Check the SDK first.** `@modelcontextprotocol/sdk` 1.x speaks 2025-11-25. The v2 packages (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`) implement 2026-07-28. Linkly is built on v2.1: `createMcpHandler`, `inputRequired`, `inputRequired.elicitUrl`, `inputResponse`, and `createRequestStateCodec`. Where the current SDK docs differ, the docs win.

> **Why URL mode, not form mode.** A "yes" from a form comes back through the client app, which could send it without asking the user. URL mode keeps the confirmation on Linkly's own page, behind the user's login: the same guarantee as the link today. That page already meets the spec's rules for URL mode. The URL isn't pre-authenticated, and only the user who started the request can confirm, because the page requires a session and finds only the session user's own actions. Keep it that way.

1. **Upgrade the SDK.**
   - Migrate `src/mcp` to the v2 packages, following the SDK's v1-to-v2 migration guide. Tools, scopes, toolsets, and result shapes stay the same.
   - Serve `/mcp` with `createMcpHandler`, still with a fresh server per request. Wasp hands `handler.ts` an Express request, so it converts it to a web `Request` and calls `handler.fetch` itself, passing the principal as `authInfo.extra`. (The `@modelcontextprotocol/node` adapter would do the same, but needs Hono as a peer dependency.)
   - Expect one behavior change: calling a tool the grant doesn't have is now a protocol error (`-32602`), not a tool result with `isError`, as the 2026-07-28 spec requires.
   - Keep its default `legacy: "stateless"`, so clients still on 2025-11-25 keep working with no sessions.
   - Set `inputRequired.legacyShim: false`. The shim serves older clients by pushing requests over a session, and a stateless server has none, so a mistake should fail loudly instead.
2. **Keep the service as it is.** `requestDeletion` still decides how a deletion happens and never imports the SDK. The MCP part goes in `src/mcp/confirmations.ts`. The registry wrapper uses it for any tool that returns `status: "confirmation_required"`, which today is only `delete_link`.
3. **The first call.** A tool returns `confirmation_required`, and the request declares `elicitation.url` in `_meta["io.modelcontextprotocol/clientCapabilities"]`. Instead of the result, return `inputRequired` with:
   - one request: `confirm: inputRequired.elicitUrl({ url: confirmUrl, message: "Confirm deleting <slug> in Linkly." })`;
   - a `requestState` minted with `createRequestStateCodec`. It holds `{ actionId }`, it's bound to the grant ID and the tool name, and its `ttlSeconds` matches the pending deletion's `PENDING_TTL_MS`.

   Check the capability on every request, never once per client: in this revision it travels with each request. A request without it, or one that declares only form mode, gets the result with `confirmUrl`, as today.
4. **The retry.** Pass the codec's `verify` as `ServerOptions.requestState.verify`: state that's been tampered with, has expired, or belongs to another grant then gets the SDK's `-32602` error before the handler runs. Then read the answer with `inputResponse(ctx.mcpReq.inputResponses, "confirm")`:
   - **Accept** only means the user agreed to open the page. Look up the pending deletion with a new service function, `getDeletionStatus(p, { actionId })`. It's for the action's owner and needs no session. Then:
     - **Confirmed:** return `{ status: "deleted", id, slug, actionId, message }`, with a `message` saying the user confirmed. The agent never sees the confirm page, so without it the result looks the same as an immediate delete.
     - **Still pending:** clients retry as soon as the page opens, usually before the user has confirmed, so don't ask again. Poll the pending deletion for up to 20 seconds, then return `inputRequired` with only a newly minted state: the client retries without prompting (after 250 ms in the SDKs). The state counts these waits. After 8 (about 2.5 minutes, inside the SDKs' cap of 10 rounds per call), return `confirmation_required` with the link.
     - **Cancelled on the page, or expired:** return a new status, `not_deleted`, with a `message` that says why.
   - **Decline:** withdraw the pending deletion so its link can't be used later, and return `not_deleted`. Add `withdrawPendingAction(p, { actionId })` for the action's owner. Withdrawing never deletes anything, so it needs no session.
   - **Cancel** (the user dismissed the prompt): return `confirmation_required` with the `confirmUrl`, so the agent can still share the link.
5. **Output and descriptions.** Add `not_deleted` to `DeleteToolOutput`. In `delete_link`'s description and the server instructions, say that in clients that support it the confirmation page opens by itself and the call finishes once the user confirms, and that otherwise the agent should share `confirmUrl`. REST doesn't change: it still returns `202` with `confirmUrl`.
6. **Config.** Add `MCP_REQUEST_STATE_KEY` (at least 32 bytes) to `.env.server.example`. Every server instance needs the same key, because any instance may get the retry. Fail at startup if it's missing or too short.
7. **Docs.**
   - Update "Why the MCP server is stateless" in `docs/ARCHITECTURE.md`: Linkly now uses URL-mode elicitation where clients support it, with `confirmUrl` as the fallback.
   - Replace the "Linkly hasn't made this upgrade yet" paragraph in Step 7 of `docs/GUIDE.md` with how Linkly does it now.

*Accept:*
- **Unit tests** in `src/mcp/`, with an in-memory v2 `Client`:
  - A client that declares `elicitation.url` gets `input_required` with the `/confirm/:actionId` URL, and nothing is deleted.
  - A client with no elicitation capability, and one with form mode only, get `confirmation_required` with `confirmUrl`.
  - On the retry, a confirmed deletion returns `deleted`, a pending one returns `input_required` again, an expired one returns `not_deleted`, and a declined one returns `not_deleted` and shows as cancelled on the confirm page.
  - State that's been tampered with, state from another grant, and expired state are rejected, and nothing is deleted.
- **End-to-end test:** a v2 `Client` that declares `elicitation: { url: {} }`, using an OAuth grant with confirmation on. Its `elicitation/create` handler starts opening the URL in the Playwright page and returns `accept` at once, like a real client. The logged-in user clicks Confirm while the server waits on the retry. `delete_link` returns `deleted`, and the link is gone. A second test declines, and the confirm page then shows the request as cancelled.
- **Older clients still work.** The existing end-to-end tests keep the v1 `Client` (a dev dependency), so they run as 2025-11-25 clients and still get `confirmUrl`. The existing REST delete tests pass unchanged.

---

## 11. Testing

Wasp only runs client tests (`wasp test client`) and doesn't support server-side tests yet, so Linkly splits tests into three kinds:

1. **Server unit tests:** plain Vitest with the root `vitest.config.ts` (`npx vitest run`), outside `wasp test`. They import only framework-free code: `schemas.ts`, `service.ts`, `src/shared/*`, `src/oauth` logic, and `src/mcp` registry and `defineTool`. They pass a real `PrismaClient` for `linkly_test` through `deps`. **This is a hard rule for the code:** these files must not import from `wasp/*`. Values like `serverUrl` are passed in by the thin Wasp adapters (`operations.ts`, `rest.ts`, `handler.ts`).
2. **Live-server tests:** everything that needs HTTP (the MCP integration test, CLI tests, OpenAPI validation, the drift test, and the end-to-end tests) runs against a real `wasp start` using the Playwright runner in `e2e/`. Don't run `wasp test` while `wasp start` is running: both compile into `.wasp/out`.
3. **Client tests** (optional): `wasp test client run` for any pure UI logic.

- **Service unit tests** per slice (real Postgres test DB, truncated between tests).
- **Parity test (`mcp/parity.test.ts`):** a hand-maintained map from every Wasp operation name to the MCP tool that covers it (or an explicit `"dashboard-only: <reason>"`). The test fails if an operation or tool is added without updating the map. This is the executable form of "MCP can do everything the dashboard can."
- **Description lint test:** every tool has a title, a description ≥ 60 characters, `.describe()` on every input field, and a correct annotation (read-only tools marked `readOnlyHint`, `delete_*` marked `destructiveHint`).
- **Integration test (`e2e/mcp.integration.spec.ts`):** against the live server, create a verified user, a PAT, and an OAuth grant with confirmation on (made directly through the grant and token services, no browser). Connect the MCP SDK `Client` over Streamable HTTP with the PAT: list tools, create a link, get stats, search docs, and delete a link (deleted immediately). Reconnect with the OAuth token and delete again: assert the `confirmUrl` shape. Repeat the OAuth delete over REST and assert `202` with the same body shape.
- **Destructive-flag agreement test:** each OpenAPI operation's `x-destructive` equals the mapped MCP tool's `destructiveHint`, and each destructive CLI command requires `--yes`.
- **CLI tests (`cli/test/`):** run the built binary as a subprocess against a test server with a PAT. Cover full link CRUD, `--json` output that parses and matches REST, delete refused without `--yes` (exit 2), bad token (exit 3), unknown link (exit 5), and a check that no command reads stdin unless `--token-stdin` is passed (run with stdin closed; nothing hangs).
- **CLI parity test:** a map from every MCP tool to its CLI command (or an explicit `"no-cli: <reason>"`). Fails when either side changes without the map.
- **Snapshot drift test:** `cli/openapi.json` equals the server's live `/api/v1/openapi.json`.
- **Verified test users (`e2e/fixtures/users.ts`, also used by Vitest):** tests never go through signup. They create users directly with Wasp's server-side auth helpers (`createUser` with a `username` provider ID). The fixture returns `{ userId, username, password }` so browser tests can log in through the real login page. Linkly uses username-and-password auth so a deployment needs no email sender; a real product would likely use email or social login instead.
- **End-to-end OAuth test (`e2e/oauth.spec.ts`, Playwright, headless):**
  - **Setup:** `playwright.config.ts` uses `webServer` to run `wasp start` against the `linkly_test` database. `wasp start` always sets `NODE_ENV=development`, which the SSRF local-dev exception allows. The `testClient.ts` fixture starts a server on a random localhost port that serves `http://localhost:<port>/client.json`, a CIMD document with `redirect_uris: ["http://127.0.0.1:<port>/callback"]`. It also records the `code` and `state` that arrive at `/callback`.
  - **Flow:** build a PKCE verifier and challenge, open `/oauth/authorize?...` in the Playwright page, log in as a verified fixture user, check that the consent screen shows the client name and the host `localhost`, pick toolsets, click Allow, read the code from the fixture, and `POST /oauth/token`.
  - **M4 assertions:**
    - Tokens are issued with the chosen scopes.
    - A token requested with `resource=${serverUrl}/api/v1` works on `GET /api/v1/me`. The same token is rejected on `/mcp` (audience check).
    - Refresh rotates the token, and reusing the old refresh token revokes the grant.
    - Clicking Deny redirects with `error=access_denied`.
    - A `redirect_uri` that isn't in the document shows the error page and never redirects.
  - **Extended in later milestones, in the same file:**
    - **M5:** connect the MCP SDK `Client` using its OAuth client provider. When the SDK asks to redirect the user, hand the URL to the Playwright page to log in and click Allow, then assert that `tools/list` works and the tool calls succeed.
    - **M7:** with "Require confirmation" on, `delete_link` returns a `confirmUrl`. Playwright opens it, clicks Confirm, and the link is gone.
    - **M8:** a grant with only Analytics ticked sees core and analytics tools only. After unticking a toolset on `/settings/connections`, the next `tools/list` reflects the change.


---

## 12. Documentation deliverables

- `README.md`: what Linkly is, how to run it, how to connect an MCP client (just the URL `<serverUrl>/mcp`), and the architecture diagram from section 2.1.
- `docs/ARCHITECTURE.md`: explains each design principle from section 1 with links to the specific files that implement it. This is the file learners should read first. It must also include:
  - **"MCP vs API vs CLI":** all three are ways for an agent to call the same tools, so what changes is the execution environment and its dependencies. Use MCP when the caller is an agent inside a chat client (OAuth from any client, tool descriptions, annotations, no shell needed). Use REST for raw data access, scripts, and integrations (it's the baseline, and OpenAPI already describes it). Use the CLI when a human or an agent has a shell (composes with pipes and `jq`, easy to debug). Include the rules from 8.3 and why each one exists: agents get stuck on interactive prompts.
  - **"If the MCP tools match the API, why have MCP?":** answer this directly, since learners will notice the tools map one to one to REST. The matching tools are deliberate, and MCP's value is in how an agent connects and uses them, not in extra abilities. Cover each point with a link to the code that implements it:
    1. **No shell needed:** chat and mobile clients can't run `curl` or a CLI, so MCP is their only way in.
    2. **Setup is pasting one URL:** OAuth discovery, CIMD, and the consent screen replace "create a token and explain the API to your agent" (`src/oauth/`).
    3. **Tools describe themselves:** clients get names, descriptions, input schemas, and server instructions when they connect, with nothing to configure (`src/mcp/defineTool.ts`, `src/mcp/server.ts`).
    4. **Safety hints clients understand:** clients act on `readOnlyHint` and `destructiveHint` (auto-run reads, ask before deletes). OpenAPI has no standard equivalent, which is why `x-destructive` is a custom extension.
    5. **Features that exist only on MCP here:** toolsets the user picks on the consent screen, the `confirmUrl` delete flow, error text written for agents, and docs as resources.

    Close with the tradeoff: for developers and coding agents with a shell, REST plus the CLI is enough. MCP pays off when non-developers use the product through an AI assistant in a chat app.
  - **"Why the MCP server is stateless":** a stateless server scales horizontally with no session affinity. Under the 2025-11-25 revision it can't send server-to-client requests, which rules out elicitation (asking the user mid-call) and push notifications, so Linkly uses the portable alternative: a `confirmUrl` in the tool result that works in every client. Explain that the 2026-07-28 revision makes the protocol stateless (the server returns the question and the client retries the call), so adding elicitation would take an SDK that speaks that revision, a check of the client's declared capabilities, a signed `requestState`, and `confirmUrl` as the fallback. Optional M12 builds this.

---

## 13. Explicitly out of scope

Do not add: codemode or code-execution tools, a "load more tools" meta-tool, client allowlists, stateful MCP sessions, MCP Apps, elicitation beyond M12, server-pushed notifications, websockets, OAuth in the CLI, interactive CLI prompts, teams, or billing. If something seems necessary that isn't in this spec, write it in `NOTES.md` as a proposal instead of building it.
