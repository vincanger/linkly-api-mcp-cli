# Linkly build notes

Per-milestone notes and deviations from `linkly-mcp-spec.md`, written while building.

## Manual checks still to do

These can't be automated. The Playwright end-to-end tests cover the same flows headless.

- _(filled in as milestones add them)_

## Decisions made without the author

Choices the spec or docs didn't settle, made conservatively so the build could continue.

- **URLs come from env, set by Wasp at startup.** `src/shared/urls.ts` reads `WASP_SERVER_URL` / `WASP_WEB_CLIENT_URL` (Wasp's own env vars, with Wasp's dev defaults) and the server `setupFn` re-applies Wasp's validated `env` values. This keeps `urls.ts` free of `wasp/*` imports so unit tests can use it. The spec said "use Wasp's server `config`"; the values are the same.
- **`toWaspHttpError` lives in `src/shared/waspErrors.ts`**, not `errors.ts`, because it needs `HttpError` from `wasp/server` and `errors.ts` must stay framework-free for unit tests.
- **Bearer auth is a handler wrapper (`withBearer`), not namespace middleware.** Some `/api/v1` routes are public (docs, `openapi.json`), so auth is applied per handler. The logic lives in `src/shared/bearer.ts` (framework-free) and `withBearer` adds the `WWW-Authenticate` header on 401.
- **Test-only fixture API.** `POST /__test/users` (in `src/testing/`) creates an already-verified user with Wasp's `createUser` + `sanitizeAndSerializeProviderData`, because passwords must be hashed the way Wasp does it and tests run in a separate process. It returns 404 unless `LINKLY_ENABLE_TEST_API=true` and `NODE_ENV` isn't `production`. Only `playwright.config.ts` sets that variable.
- **Every link lookup accepts an ID or a slug** (get, update, delete, stats), not only `getLink`: agents often only know the slug.
- **Service outputs use ISO strings for dates**, so the same object is valid JSON for REST, MCP `structuredContent`, and the CLI.
- **Random slugs** use a 32-character alphabet without look-alike characters (no `l`, `o`, `0`, `1`).
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
