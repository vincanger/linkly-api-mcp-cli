# Linkly

Linkly shortens links and counts clicks. It's a small product on purpose: it exists as a **teaching reference for a well-structured MCP server**. One service layer is exposed four ways: a dashboard, a REST API, an MCP server, and a CLI built on the REST API.

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

## Learn how it works

Start at the top and go deeper as you need to:

1. [Linkly's Four Ways In](https://claude.ai/artifact/QAS55rqPuKkD1ccAGc6M31) (animation): one "create a link" request through all four surfaces to the same service function.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): every design decision, why it was made, and the code that implements it.
3. [`docs/OAUTH-FOR-AGENTS.md`](docs/OAUTH-FOR-AGENTS.md): how an MCP client logs in with no registration, for newcomers to OAuth.
4. [`docs/AGENT-READY-APPS.md`](docs/AGENT-READY-APPS.md) covers when to use the options (API, CLI, MCP), auth, and the fastest path. It also includes notes on what Wasp can do to provide these in the future.

For the build itself, [`SPEC.md`](SPEC.md) is the full spec. There still exist some optional implementation milestones.

## Run it

Requirements: Node 24+, [Wasp](https://wasp.sh) 0.25, Docker (for the dev database).

```bash
npm install
cp .env.server.example .env.server   # skips email verification locally
wasp start db                         # Postgres in Docker; keep it running
wasp db migrate-dev                   # in another terminal
wasp start                            # client on :3000, server on :3001
```

Sign up at http://localhost:3000. Emails (verification, password reset) are printed to the server console.

## Connect an AI assistant (MCP)

Add `http://localhost:3001/mcp` as a custom connector or MCP server. With Claude Code:

```bash
claude mcp add --transport http linkly http://localhost:3001/mcp
```

Your browser opens Linkly's consent screen. Log in, click Allow, and it's connected. Manage connected apps at `/settings/connections`.

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
```

Create the test database once: `docker exec <wasp-dev-db container> psql -U postgresWaspDevUser -c "CREATE DATABASE linkly_test;"`, or point `TEST_DATABASE_URL` at any Postgres database. What each kind of test covers is in [Testing strategy](docs/ARCHITECTURE.md#testing-strategy).
