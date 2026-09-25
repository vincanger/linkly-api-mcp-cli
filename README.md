# Linkly

Linkly shortens links and counts clicks. It's a small product on purpose: it exists as a **teaching reference for a well-structured MCP server**. One service layer is exposed four ways, as a dashboard, a REST API, an MCP server, and a CLI built on the REST API. OAuth works from any MCP client without registration.

Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): it explains each design decision and links to the code that implements it. The full build spec is [`linkly-mcp-spec.md`](linkly-mcp-spec.md), and [`NOTES.md`](NOTES.md) records what was built per milestone and where it deviates from the spec.

## Architecture

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

Code is organized by feature (`src/links`, `src/analytics`, `src/oauth`, ...). Each feature's business logic and authorization live in its `service.ts`; the dashboard, REST, and MCP adapters only parse input, build a `Principal`, call the service, and format output.

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

Add this URL as a custom connector / MCP server:

```
http://localhost:3001/mcp
```

The client discovers Linkly's OAuth server from the `401` response, you log in and approve on the consent screen, and it's connected. No API key or app registration. Manage connected apps at `/settings/connections`.

For a real client like Claude, Linkly must be reachable over public HTTPS (for example through a tunnel), with `WASP_SERVER_URL` and `WASP_WEB_CLIENT_URL` set to the public URLs.

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

The test database: `docker exec <wasp-dev-db container> psql -U postgresWaspDevUser -c "CREATE DATABASE linkly_test;"` once, or point `TEST_DATABASE_URL` at any Postgres database.
