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
