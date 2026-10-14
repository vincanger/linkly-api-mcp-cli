# Linkly

Linkly is a small link shortener that counts clicks. It's the example app for the Wasp blog post [How to make your app usable by AI agents (MCPs, APIs, CLIs)](BLOG_POST_URL), <!-- TODO: replace BLOG_POST_URL with the post's URL on wasp.sh/blog --> and it's meant to be read alongside it. All the examples in the post come from this repo, so if you want to see the full code behind a snippet, it's here.

The post's advice, in short:

- **Build a good MCP server and a REST API at the same time, on one layer of operations.** Your logic lives in plain functions, and each surface is a thin adapter over them.
- **Put most of your care into the MCP server.** It's the standard built for agents, and it's where they get the best experience: tools written for the model, OAuth login with no setup, and destructive actions that wait for the human to confirm in your app.
- **Use the API for code that runs on its own,** like exports, bulk writes, nightly syncs, other companies' integrations, and scripts an agent writes and reruns.
- **A CLI probably isn't necessary,** unless agents need to work with local files. But it's easy to add once you have a good API underneath.

Linkly follows that structure. The dashboard, the REST API, and the MCP server all call the same service functions, and the CLI is a client of the REST API:

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

  CLI (user's machine) ── HTTP + token ──▶ REST API
```

## Where to find things

Each part of the post's guide maps to a spot in the repo:

- **Operations:** `src/<feature>/service.ts` (links, analytics, account, docs), with the dashboard's Wasp operations, `rest.ts`, and `mcp.ts` next to each one.
- **The MCP server:** [`src/mcp/`](src/mcp/) for the server and tool registry, and each feature's `mcp.ts` for its tools.
- **The REST API:** each feature's `rest.ts`, plus the OpenAPI document generated from the same schemas in [`src/openapi/`](src/openapi/).
- **OAuth:** [`src/oauth/`](src/oauth/). One OAuth server sits in front of both MCP and REST, clients identify themselves with CIMD (no registration), and the consent screen lets people choose each permission. Personal access tokens are there for scripts and the CLI.
- **Destructive actions:** [`src/mcp/confirmations.ts`](src/mcp/confirmations.ts) (URL-mode elicitation) and [`src/deeplinks/`](src/deeplinks/), the confirmation pages in Linkly that MCP and REST both send you to.
- **The CLI:** [`cli/`](cli/), with its types generated from the OpenAPI document.
- **Discovery:** [`src/discovery/`](src/discovery/) for `llms.txt` and the API catalog at `/.well-known`.
- **Parity tests:** [`src/mcp/parity.test.ts`](src/mcp/parity.test.ts), [`tests/cliParity.test.ts`](tests/cliParity.test.ts), [`tests/destructiveFlags.test.ts`](tests/destructiveFlags.test.ts), and [`cli/test/drift.spec.ts`](cli/test/drift.spec.ts) keep the surfaces from drifting apart.

There's also an animation, [Linkly's Four Ways In](https://claude.ai/artifact/QAS55rqPuKkD1ccAGc6M31), that follows one "create a link" request through all four surfaces to the same service function.

## Run it

Requirements: Node 24+, [Wasp](https://wasp.sh) 0.25, Docker (for the dev database).

```bash
npm install
cp .env.server.example .env.server   # dev settings: a dev MCP signing key
wasp start db                         # Postgres in Docker; keep it running
wasp db migrate-dev                   # in another terminal
wasp start                            # client on :3000, server on :3001
```

Sign up at http://localhost:3000. Emails (verification, password reset) are printed to the server console.

Already have a `.env.server`? Copy `MCP_REQUEST_STATE_KEY` into it from the example: the server won't start without it.

## Connect an AI assistant (MCP)

Add `http://localhost:3001/mcp` as a custom connector or MCP server. With Claude Code:

```bash
claude mcp add --transport http linkly http://localhost:3001/mcp
```

Your browser opens Linkly's consent screen. Log in, click Allow, and it's connected. Manage connected apps at `/settings/connections`.

Deletions wait for your confirmation, unless you turn that off for the connection. Claude Code opens Linkly's confirmation page itself after asking you; other clients give you a link to open.

Local clients (Claude Code, Cursor, VS Code) reach `localhost` directly. Web-hosted clients such as claude.ai need Linkly on a public HTTPS URL (for example through a tunnel), with `WASP_SERVER_URL` and `WASP_WEB_CLIENT_URL` set to the public URLs.

## REST API and CLI

Create a personal access token at `/settings/tokens`, then:

```bash
curl -H "Authorization: Bearer $LINKLY_TOKEN" http://localhost:3001/api/v1/links
```

The OpenAPI 3.1 document is at `http://localhost:3001/api/v1/openapi.json`.

The CLI lives in [`cli/`](cli/):

```bash
cd cli && npm install && npm run build && npm link
linkly auth login --token lk_pat_...
linkly links create https://example.com --slug launch
linkly links list --json | jq '.data[].shortUrl'
```

## Tests

```bash
npm test          # server + CLI unit tests (Vitest, against the linkly_test database)
npm run test:e2e  # Playwright: starts `wasp start` on linkly_test, runs browser, REST, MCP, OAuth, and CLI tests
npm run test:build  # wasp build + a client build: llms.txt and prerendered pages (not while wasp start runs)
```

Create the test database once: `docker exec <wasp-dev-db container> psql -U postgresWaspDevUser -c "CREATE DATABASE linkly_test;"`, or point `TEST_DATABASE_URL` at any Postgres database.
