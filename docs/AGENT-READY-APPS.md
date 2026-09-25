# Making a web app usable by agents

What to build so AI agents can use your app, in what order, and how Linkly does each part. For how the pieces fit together inside Linkly, see [ARCHITECTURE.md](ARCHITECTURE.md).

## The short answer

- **Build a REST API first.** It's the baseline every other way in can be built on: scripts, a CLI, even an MCP server.
- **Add MCP when non-developers will use your app through a chat assistant** (Claude, ChatGPT, including their mobile apps). It's the standard way those clients connect to apps: the user adds one URL and logs in. The alternatives are off by default, work in only one client, or make the user handle tokens: a code sandbox with network access, an agent clicking through your UI, or a custom GPT calling your OpenAPI spec.
- **Doing both is cheap if logic lives in one service layer.** Linkly's REST handler and MCP tool for "create a link" are one line each ([`rest.ts`](../src/links/rest.ts), [`mcp.ts`](../src/links/mcp.ts)). The rules live once, in [`service.ts`](../src/links/service.ts).

## The options

| | Good for | Costs |
|---|---|---|
| **REST API + tokens** | Scripts, integrations, coding agents with a shell | Users must create a token and explain the API to their agent |
| **CLI over the API** | Humans and agents with a shell; composes with pipes and `jq` | Needs a runtime and a shell. Nearly free if generated from OpenAPI |
| **MCP server** | Agents in chat apps: users paste one URL and click Allow | OAuth is the real work |
| **ChatGPT GPT Actions** | A custom GPT that calls your REST API from your OpenAPI spec | ChatGPT only; each GPT is configured separately |
| **OpenAPI and skills discovery at `/.well-known`** | Agents finding an API with no MCP | Proposals, not standards yet (Linkly's optional M10 in [SPEC.md](../SPEC.md#optional-milestones)) |
| **Browser automation** | Apps you don't control | Slow and brittle. Not something to design for |

## The OpenAPI shortcut

A common tip: **write an OpenAPI spec, then generate the CLI and the MCP server from it.** It's good advice, with two refinements.

**Generate the spec from code, not by hand**, so it can't drift from what the server does. Linkly builds it from the same Zod schemas that validate requests ([`src/openapi/document.ts`](../src/openapi/document.ts)).

**The CLI generates well.** Linkly's is exactly this: `npm run gen` fetches `openapi.json` and generates typed client code with `openapi-typescript` ([`cli/package.json`](../cli/package.json), [`cli/src/api.ts`](../cli/src/api.ts)), and a test fails if the committed spec differs from the server's ([`cli/test/drift.spec.ts`](../cli/test/drift.spec.ts)).

**For MCP, generate to start, then curate.** Converting each operation into a tool gets you a working server fast. What a generator can't give you:

- **Descriptions written for agents**: when to use a tool, which related tools exist, and what to do after an error. Linkly lints these ([`descriptions.test.ts`](../src/mcp/descriptions.test.ts)).
- **Safety annotations** such as `destructiveHint`. You can map them from an OpenAPI extension; Linkly checks that `x-destructive` and `destructiveHint` agree ([`destructiveFlags.test.ts`](../tests/destructiveFlags.test.ts)).
- **Task-shaped tools**: fewer, higher-level tools usually work better than one per endpoint.
- **OAuth login, toolsets, and confirmation links**, which live outside the spec.

Linkly writes its MCP tools by hand over the same services and uses tests to keep all surfaces in sync.

## Auth

### For the API: personal access tokens

Random tokens with a recognizable prefix (`lk_pat_…`). Only the SHA-256 hash is stored, and the raw value is shown once. Each has scopes, an optional expiry, and a revoke button. Sent as `Authorization: Bearer`. See [`src/tokens/service.ts`](../src/tokens/service.ts) and [`src/shared/bearer.ts`](../src/shared/bearer.ts).

### For MCP: OAuth 2.1 with PKCE, with your app as the authorization server

1. **Discovery.** A request with no token gets `401` with a `WWW-Authenticate` header pointing at your protected-resource metadata, which points at your authorization-server metadata ([`withBearer`](../src/shared/http.ts), [`metadata.ts`](../src/oauth/metadata.ts)).
2. **Client identity (CIMD).** The client's `client_id` is an HTTPS URL. You fetch its JSON (guarding against internal addresses), so there's no registration and no allowlist ([`cimd.ts`](../src/oauth/cimd.ts), [`ssrf.ts`](../src/oauth/ssrf.ts)). Some older clients only support Dynamic Client Registration (DCR), which Linkly leaves to optional M11.
3. **Consent.** The user sees which app is asking (by its `client_id` domain) and picks what it may do ([`ConsentPage.tsx`](../src/oauth/ui/ConsentPage.tsx)).
4. **Short-lived tokens.** A 1-hour access token tied to one resource, and a refresh token that's replaced on every use; reusing an old one revokes the connection ([`token.ts`](../src/oauth/token.ts)).
5. **Every request** rebuilds permissions from the saved grant, so changes on a "Connected apps" page apply on the agent's next call.

The concepts, step by step: [OAUTH-FOR-AGENTS.md](OAUTH-FOR-AGENTS.md).

**Safety for agents.** Mark destructive tools with `destructiveHint`, and have deletes from OAuth connections return a URL the human opens to confirm ([`requestDeletion`](../src/links/service.ts)). This works in every client, unlike elicitation.

## Fastest path

1. **Move logic into services** that take `(principal, input, deps)`. Everything else depends on this.
2. **REST + PATs**, with an OpenAPI document generated from your schemas.
3. **A stateless MCP server with PAT auth** at `POST /mcp`, whose tools call the same services ([`handler.ts`](../src/mcp/handler.ts)). This already works in Claude Code, Cursor, and VS Code:
   ```bash
   claude mcp add --transport http myapp https://myapp.com/mcp --header "Authorization: Bearer <token>"
   ```
   **This is the fastest useful MCP.**
4. **OAuth with CIMD**, for chat and web clients and one-click setup. The biggest piece.
5. **A CLI generated from OpenAPI**, if your users have shells.

## In Wasp

Most of the friction I hit was generic plumbing that Wasp could provide:

- a bearer-token or PAT auth mode for `api()` routes;
- `PATCH` in api();
- a built-in OAuth provider mode (Wasp as the authorization server, with CIMD);
- an MCP adapter that turns operations into tools;
- server-side testing.
