# Notes

Open work, manual checks, and decisions that aren't in the code or the spec yet. Deviations from `SPEC.md` are recorded in the spec itself (see M12).

## Next tasks

Roughly in priority order.

1. **Error hints for each surface.** REST errors reuse the MCP text, e.g. `Use list_links to find valid IDs or slugs.` REST should say `GET /links`, the CLI `linkly links list` (`toErrorResponse` in `src/shared/errors.ts`).
2. **Resolve the TODOs in `docs/GUIDE.md`:** the checklist one (move the CLI later, to step 9 or 10? Suggestion: keep it at 8 but make it optional in the levels), and the empty one before Step 8.
3. **Make `docs/GUIDE.md` the main entry.** Point the README at it and retire `docs/AGENT-READY-APPS.md`, moving its "In Wasp" list to a Wasp notes file.
4. **Token-in-environment-variable guidance** in GUIDE Steps 4 and 8: check that the token exists, never print it, prefer read-only tokens. It keeps the value out of context, but unlike MCP the agent can still send it anywhere. (The `llms.txt` rules already say this, since M10.)
5. **Publish the guide as a shareable page** for reviewers.
6. **M11: Dynamic Client Registration fallback.** Lowest priority: the 2026-07-28 spec deprecates DCR.

The blog post plan and its open questions are in [`docs/BLOG-POST-NOTES.md`](docs/BLOG-POST-NOTES.md).

Undecided:
- Mention PostHog and Sentry in the guide as examples of good agent onboarding?

Declined (don't re-propose): from Rhys's article, (1) curated tools plus a generic `api` tool, (2) a callout for OAuth on the REST API too, (3) "don't ship only client-specific plugins".

## M10: agent discovery (built 2026-10-13)

Built as specified: `llms.txt` written by a Vite plugin at build time (and served by the dev server), prerendered homepage and docs, "For AI agents" on the homepage, "Connect an AI agent" on Connections, the `service-desc` header on `/api/v1`, and `/.well-known/openapi.json`. Choices and differences from `SPEC.md`:

- **Paths** are in `src/discovery/paths.ts`. As of October 2026 there's still no registered `/.well-known` path for an OpenAPI document (the OpenAPI Initiative's issue for one never went anywhere), so `/.well-known/openapi.json` stays as the spec's best guess.
- **Added `/.well-known/api-catalog` (RFC 9727).** It's the one registered well-known path for API discovery, so it counts as the "current proposal" the spec says to follow. It's a linkset pointing at the OpenAPI document, the REST docs page, and `llms.txt`. Few providers serve it yet, so it's kept small.
- **`wasp start` does prerender** in Wasp 0.25: the dev server serves real HTML for prerendered routes. So `e2e/discovery.spec.ts` checks step 1 against the dev server, and `npm run test:build` (`tests/build/discovery.check.ts`) checks a real `wasp build` plus `vite build` with a set `REACT_APP_API_URL`.
- **Prerendered pages use `useOrigin()`** (`src/app/useOrigin.ts`) instead of reading `window` while rendering: dashboard links are root-relative in the HTML and become absolute after hydration, with no hydration mismatch.
- **The `llms.txt` rules** also cover keeping a personal access token in an environment variable (next task 4).

## Manual checks still to do

- **M12 with a real client.** Needs Linkly's dev database: another project's Postgres container (`wasp-dev-db-checkonchainMcp-…`) was holding port 5432. Then `wasp start db`, `wasp start`, reconnect Linkly in Claude Code CLI 2.1.281+ (`/mcp`) over OAuth with "Require confirmation" on, and ask it to delete a test link. Expect the "open this page?" prompt, then `deleted` once confirmed on the page. (Personal access tokens delete immediately, so they don't test this.)
- **M4 (MCP Inspector OAuth) and M5 (real client over OAuth)** from `SPEC.md`: results weren't kept when the previous `NOTES.md` was removed. Re-check if needed. The Inspector can't do Linkly's OAuth without DCR (M11); use a token header.

## Client support for URL-mode elicitation (October 2026)

Over 2026-07-28 `input_required`, which is what Linkly needs:
- Claude Code CLI 2.1.281+: yes, by default.
- OpenCode v2 (`@opencode/cli`): only with `protocol: "2026-07-28"` or `"auto"` per server. v1 (default install): no.
- Codex: built, behind the off-by-default `mcp_2026_07_28` flag.
- ChatGPT, Claude Desktop, claude.ai, Claude Code IDE panel: no (ChatGPT supports form mode).
