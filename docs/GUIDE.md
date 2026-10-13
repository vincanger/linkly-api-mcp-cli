# How to make your app usable by AI agents

More and more people will use your product through an AI agent: a coding agent in their terminal, a chat assistant on their phone, or an agent that's only been told your domain. This guide says what to build so those agents can use your app safely, in what order, and how to tell when each step is done.

It works for any stack. The code sketches are TypeScript, but nothing depends on a framework. The examples come from [Linkly](../README.md), a small open-source link shortener built as a reference for this guide. Every step links to the code that implements it, if you want to see the real thing.

## The checklist

1. Put your logic in operations that any surface can call.
2. Describe every operation for agents: what it does, its inputs and outputs, the permission it needs, and whether it reads, writes, or destroys.
3. Define permissions once, and check them inside the operation.
4. Add an MCP server over the same operations.
5. Let people connect with OAuth, and let them choose each permission.
6. Make destructive actions wait for the human.
7. Add a REST API with personal access tokens and  OpenAPI document.
8. Add a CLI, if your users have shells.
9. Help agents find you from your domain alone.
10. Add tests that keep the surfaces in sync.

You don't need all ten on day one:

- **Level 1, every agent can connect:** steps 1–6. Coding agents and chat apps connect with one URL, and deletions wait for the human.
- **Level 2, scripts and shells too:** add steps 7–8.
- **Level 3, agents find you and nothing drifts:** add steps 9–10.

**The smallest setup that reaches both coding agents and chat apps** is well-described operations (Steps 1–3), a thin MCP server over them (Step 4), and OAuth that accepts any client (Step 5).

## The mental model

Build your app in two layers:

1. **Operations:** your business logic, one function per thing a user can do, plus the metadata an agent needs to use it well.
2. **Surfaces:** thin adapters that expose those operations to each kind of caller.

```
 Who's calling                 Surface                  Your app
 A person in a browser    ──▶  Dashboard   ──┐
 Scripts, coding agents   ──▶  REST API    ──┼──▶  Operations (logic + metadata)  ──▶  Database
 Chat apps, coding agents ──▶  MCP server  ──┘
 Agents with a shell      ──▶  CLI  ──▶  REST API
```

Most of the work, and most of the value, is in the first layer. If your operations are well defined, with clear descriptions, schemas, and permissions, each surface is a short adapter. If they aren't, every surface re-implements the rules, and they drift apart.

<!-- TODO (AGENT): this entire section below is taken from Rhys's https://x.com/RhysSullivan/status/2070630745891365008 we need to rewrite this section and give credit in the original article -->
## Which surfaces do you need?

### MCP
MCP seems to be the right protocol to use for any interactions that are with agents, some examples of this are:
Claude Channels is built on MCP and allows you to push data back into a running session via an MCP
MCP Apps allows for embedding ui directly inside of chats, i.e "show me a chart of my posthog data"
MCP Elicitation enables getting actual input from humans, this is really useful when you need them to confirm something like "are you okay with analytics" or going to a url to perform an action
MCP Triggers to notify clients of state changes
now the trouble with these is there's a chicken and egg problem. most clients only implement support for MCP tools and that's it. what's cool though is you can actually work around partial client support but doing the same functionality over tool calls only as a fallback, which i'll have a longer post coming on

### APIs
where i'm landing on APIs is they're great for raw data access and quickly converting your app to be agent accessible. APIs carry good information already about their descriptions, what operations are destructive / not destructive / etc
to me, it doesn't make sense to try to get behavior like mcp apps, elicitation, triggers through OpenAPI as that's not meant to be for agents, mcp is

### CLI
this is going to be controversial, but i really think that CLIs are just for humans when looking at the long term horizon. a bit part of this comes down to the known action space of a CLI, in that for people that want to know what an agent is actually able to do
the other part about CLIs is requiring a unix shell to run them. when we look at enabling every person in the world to have a personal assistant or interact with their data through ai, the overhead of CLIs very quickly makes this not possible
that's not to say that they're bad though, i would easily argue the CLIs produced by @steipete are state of the art for agents because of how much care has been put into the design of their interfaces, their ability to get data in hard to reach places, etc
today CLIs provide the best debuggability, interfacing, data access, etc to agents because of the beautiful composability of bash and everything running them locally on your computer enables
back in March we saw a lot of writing around 'Building CLIs for agents' and fundamentally it just comes down to bash being the wrong primitive for agents to be using. there's too many footguns for them to get trapped in i.e when they run a command that prompts for human input

### closing
at the end of the day, you can convert an API into an MCP into a CLI back into an MCP back into an API
they're all the same concept, giving the agent the ability to invoke tools, what changes is the amount of dependencies and capabilities the agent gets when using it
APIs are probably fine for 90% of applications, CLIs are the best for agents today just due to the robustness of bash, MCP has a lot of potential to solve the problems presented by using CLIs today, however, it's going to require spec improvements and good harness implementations so hopefully fable comes back


- **Start with MCP.** It's the one surface that reaches both coding agents and chat assistants, and it's the standard way chat apps connect to other services: the user adds one URL and clicks Allow. The alternatives are off by default, work in only one client, or make the user handle tokens. The full list of benefits and limits is in [The case for MCP](#the-case-for-mcp).
- **Add a REST API for scripts and integrations,** or point the one you have at your operations. It's a thin layer over the same functions.
- **A CLI is nearly free** once you have an OpenAPI document, and coding agents with a shell like it.

If all your users are developers with shells, REST plus a CLI also works. MCP still gives them one-click login and safety hints the client acts on.

For plain tool calls, the surfaces are interchangeable: turn an MCP server into a CLI and the tools stay the same. What changes is where the agent runs, who holds the credentials (the agent's shell or the client), and whether the agent can use MCP's interaction features, such as asking the user a question mid-call (Step 4).

## Step 1: Put your logic in operations

**Do:**

- Write one function per operation: `createLink`, `listLinks`, `deleteLink`.
- Give each one the same signature: who's calling, the input, and its dependencies.
- Keep HTTP, MCP, and your web framework out of these functions. They validate input, apply business rules, check permissions, and throw typed errors.
- Treat your own dashboard as just another surface that calls them.

```ts
// Who's calling. Every surface turns its own kind of login into one of these.
type Principal = {
  userId: string;
  permissions: Set<Permission>;
  via: "session" | "token" | "oauth";
  confirmDestructive: boolean; // see Step 6
};

export async function createLink(caller: Principal, input: unknown, deps: Deps): Promise<LinkOut> {
  requirePermission(caller, "links:write");
  const data = LinkInput.parse(input);
  if (data.slug) await assertSlugFree(deps.db, data.slug); // throws a "conflict" error
  return toLinkOut(await deps.db.link.create({ data: { ...data, userId: caller.userId } }));
}
```

**Why:** every rule then lives in one place, and adding a surface means writing an adapter, not re-implementing the app.

**Done when:**

- You can call each operation from a unit test with no server running.
- Your dashboard's handlers and your API's handlers call the same functions.

**In Linkly:** [`src/links/service.ts`](../src/links/service.ts), [`Principal`](../src/shared/principal.ts), [`DomainError`](../src/shared/errors.ts).

## Step 2: Describe every operation for agents

An agent only knows what you tell it. For each operation, write down:

| Field | Example | Where it shows up |
|---|---|---|
| Name | `create_link` | MCP tool name, OpenAPI `operationId`, CLI command |
| Description, written for an agent | "Creates a short link… a taken slug returns a conflict. To change it later, use update_link." | Tool description, OpenAPI description, `--help` |
| Input and output schemas, every field described | `slug`: "3–40 chars of a-z, 0-9, '-'. Omit it for a random one." | Tool input schema, request and response bodies, flags |
| Permission | `links:write` | Scope check, OpenAPI security, which tools are listed, consent screen |
| Effect | `read`, `write`, or `destructive` | MCP `readOnlyHint` and `destructiveHint`, OpenAPI `x-destructive`, the CLI's `--yes` |

A good description says what the operation does, when to use it instead of a related one, what it returns, and what to do after common errors.

**One source of truth.** Each operation's metadata should come from one place. There are two ways to get there:

- **Generate the surfaces from one declaration,** when a framework or library does it for you. Code-first tools define procedures or routes with schemas and metadata, and generate OpenAPI and sometimes MCP from them. Spec-first tools start from an annotated OpenAPI document and generate SDKs, CLIs, and MCP servers.
- **Write each surface by hand, and add tests that fail when they disagree** (Step 10).

Linkly mixes them. The schemas are declared once and the OpenAPI document is generated from them, and the CLI is generated from that document. The remaining metadata (descriptions, permissions, and destructive flags) is written per surface, because explicit adapters are easier to learn from, and tests check that it agrees.

Either way, **the permission and the effect must never differ between surfaces.** A description that drifts is annoying. A delete that's marked destructive on one surface and not another is a bug.

**Done when:** every operation has all five fields, and a test or generator guarantees each surface uses them.

**In Linkly:** [`src/links/schemas.ts`](../src/links/schemas.ts) (one set of Zod schemas for every surface), [`src/links/mcp.ts`](../src/links/mcp.ts), [`src/links/openapi.ts`](../src/links/openapi.ts).

## Step 3: Define permissions once, and check them in the operation

**Do:**

- **Keep one list of permissions,** split by resource and access level, each with a label a person understands:

  ```ts
  export const PERMISSIONS = {
    "links:read": "View your links",
    "links:write": "Create, edit, and delete your links",
    "analytics:read": "View click analytics",
  } as const;
  ```

- **Give every operation exactly one required permission,** and check it inside the operation, not in the adapters. Then REST, MCP, and the CLI all get the check for free.
- **Check ownership in the operation's logic.** Permissions say which *kinds* of action a caller may take. Ownership says *which records*: "is this your link?".
- **Give a logged-in person every permission.** They're already in the product, so "the dashboard can do it" and "an agent with every permission can do it" mean the same thing.
- **If your app has teams or roles,** an agent can do what its user can do, limited further to what the user granted it. It never gets more than the user has.
- **If write access returns data, it can already read.** In Linkly, updating a link returns the whole link. So treat write as including read, and don't offer "write but not read".

**Why:** a single read-and-write permission for everything is the most common reason people won't connect an agent to real data. Users need to be able to say "look, but don't touch".

**Done when:** a caller with only `links:read` can list links, is refused when it tries to create one, and every surface behaves the same way.

**In Linkly:** [`src/shared/scopes.ts`](../src/shared/scopes.ts), [`requireScope`](../src/shared/principal.ts), [`findOwnedLink`](../src/links/service.ts).

## Step 4: Add an MCP server over the same operations

**Do:**

- **Serve MCP over HTTP at one URL,** such as `POST /mcp`, with a thin tool per operation that calls the same function your dashboard calls.
- **Keep it stateless:** build a fresh server for each request. Any instance can then serve any request, with no sessions to share. The current MCP spec (2026-07-28) is stateless too: a server that needs the user's input returns the question, and the client retries the call with the answer (see Step 6).
- **Build it together with OAuth** (Step 5). That's how people connect: they add your MCP URL to their client, log in, and click Allow. It works the same in coding agents and chat apps.

**Design the tools:**

- **Cover every capability, but don't duplicate tools.** An agent can only do what a tool lets it do, so everything a user can do in your app should be reachable. Use parameters for variations of one action: `get_link_stats` takes `groupBy: day | referrer` instead of shipping a second tool for referrers, and `get_dashboard_url` takes a `view` that covers seven pages. Linkly covers its whole dashboard with 11 tools. Near-duplicate tools make it harder for the model to pick the right one, however the client loads them.
- **Know that clients load tools differently.** Some put every tool definition in context up front; others, such as Claude Code, search for tools and load them as needed. A long list is cheap in the second kind and expensive in the first, and you can't choose your users' clients.
- **Leave code mode and lazy loading to the client.** Loading tools on demand and running tools from code are the client's job, and two servers that each bring their own don't combine well. The exception is an API far too large to list as tools: Cloudflare's MCP server covers more than 2,500 endpoints with two tools, `search()` and `execute()`, that run the model's code against its OpenAPI document. The cost is that a client can't tell a read from a delete inside `execute()`, so read-only hints and per-tool approvals stop helping. If you go this way, keep permissions and confirmations on the server.
- **Don't merge tools across a permission or risk boundary.** A single `manage_link(action=...)` means fewer tools, but clients read safety hints per tool, and a read-only connection can't hide half a tool. Split tools where the permission or the risk changes, and use parameters everywhere else.
- **List only the tools the connection can use.** If a connection lacks `links:write`, leave out the write tools. The agent gets a shorter list and less to read. This is for context only: the real check is still in the operation.
- **Optionally, let users pick groups of tools** ("toolsets"), for example with a URL parameter such as `?toolsets=links`. Many clients can't customize which tools they load, so keep the real limits on the grant, and let the choice only narrow the list.
- **Set the annotations.** Clients use `readOnlyHint` and `destructiveHint` to decide what to run automatically and what to ask about first.
- **Declare output schemas.** Clients that run tools from code (see Step 8) generate types from them, so the model doesn't have to guess the shape of a result.
- **Write the server's instructions:** a few sentences, sent when the agent connects, on what your app is and how the tools fit together.
- **Add a docs search tool,** so the agent can look up how a concept works instead of guessing. Agents use these a lot, and they're a cheap way to teach an agent your product. Skills (packaged instructions for common tasks) do the same job; see the status box on shipping them over MCP.
- **Return links for the human, and add a tool that builds them.** Results include a URL that opens the item in your app, so the agent can say "here it is" and the user can check or edit it themselves. A link-building tool goes further: it returns a URL to any view, such as a specific chart or a form prefilled with what the user asked for. People still want your dashboard and your charts; they just don't want to click through menus to reach them.

**Use MCP's other features where clients support them, with a fallback for the rest.** Beyond tools, MCP lets a server ask the user a question mid-call (elicitation), show UI inside the chat (MCP Apps), and tell the client that something changed (notifications). Many clients only support tools, so give each feature a version that works with tools alone:

| Feature | Fallback that works in every client | In Linkly |
|---|---|---|
| Ask the user to confirm something | Return a URL the user opens to confirm (Step 6) | `confirmUrl` on deletes, and URL-mode elicitation where clients support it |
| Show a chart or a form in the chat | Return a link to that view in your app | `dashboardUrl` in results, and `get_dashboard_url` |
| Tell the client that something changed | Reflect the change on the next request | The tool list is rebuilt from the grant on every request |

**Why:** MCP is the one surface that reaches both coding agents and chat apps. For plain tools, it adds no abilities the REST API lacks: its value is in how the agent connects, discovers the tools, and learns which ones are safe, plus the interaction features above. Compared with a CLI, every MCP server also logs in the same way (the OAuth flow in Step 5), where each CLI invents its own login. And clients can index and search a server's tool catalog, where a CLI's `--help` is free text. The full list is in [The case for MCP](#the-case-for-mcp).

**Done when:**

- An agent connected to your MCP URL lists your tools and can call them.
- A connection granted only read permissions lists no write tools.

**In Linkly:** [`src/mcp/handler.ts`](../src/mcp/handler.ts), [`src/mcp/registry.ts`](../src/mcp/registry.ts), [`src/mcp/server.ts`](../src/mcp/server.ts), [`src/links/mcp.ts`](../src/links/mcp.ts), [`src/deeplinks/mcp.ts`](../src/deeplinks/mcp.ts) (the link-building tool), [`src/docs/mcp.ts`](../src/docs/mcp.ts) (docs search).

## Step 5: Let people connect with OAuth, and choose each permission

This is how people connect to your MCP server, from coding agents and chat apps alike. The user adds your MCP URL, a browser window opens, they log in, choose what the agent may do, and click Allow. Nobody creates or pastes a token.

**Do:**

- **Answer unauthenticated requests with a pointer.** Send `401` with a `WWW-Authenticate` header pointing at your protected-resource metadata. That document names your authorization server, whose metadata lists its endpoints. From there, clients find the login without any setup.
- **Accept clients without registration.** With Client ID Metadata Documents (CIMD), the client's ID is an HTTPS URL, and the JSON there lists its name and redirect URIs. Fetch it with guards against internal addresses. (Older clients may still need Dynamic Client Registration, which the current spec deprecates.)
- **Let people connect from any client.** Don't keep an allowlist of approved apps. It adds friction without adding security: the consent screen, which shows the app's domain, is the real check, and your users decide which apps they trust.
- **Build a consent screen** that shows:
  - **which app is asking,** by the domain of its client ID, with a note that you haven't verified it;
  - **one checkbox per permission,** so a user can allow viewing without allowing changes. Ticking write ticks read (see Step 3).
  - **a "require confirmation for destructive actions" toggle,** on by default (see Step 6).
- **Use the standard security pieces:** a single-use authorization code, PKCE, access tokens that expire within an hour and work only for your MCP (or API) address, and refresh tokens that are replaced on every use. Reusing an old refresh token should revoke the connection.
- **Store each approval as a grant,** and rebuild the caller's permissions from it on every request. Save the permissions the app asked for too: a user can later remove or restore permissions, but never grant more than the app requested.
- **Add a "Connected apps" page** where users see each app, change its permissions, and disconnect it. Changes apply on the app's next request.

If your auth provider already supports the MCP authorization spec, use it instead of building your own. Otherwise, every piece above is standard and well specified, so a coding agent can build it from a reference: Linkly builds its own to show the moving parts.

**Done when:**

- Adding just your MCP URL in a client opens your consent screen and connects.
- Unticking a permission on "Connected apps" removes those tools on the agent's next request.

**In Linkly:** [`src/oauth/`](../src/oauth/), [`ConsentPage.tsx`](../src/oauth/ui/ConsentPage.tsx), [`grants.ts`](../src/oauth/grants.ts). For the concepts step by step, read [OAuth for agents, explained](OAUTH-FOR-AGENTS.md).

## Step 6: Make destructive actions wait for the human

**Do:**

- **Mark destructive operations on every surface:** `destructiveHint` in MCP, `x-destructive` in OpenAPI, and a required `--yes` in the CLI.
- **Return a confirmation link instead of deleting.** When an agent connected through OAuth asks to delete, respond with a URL (REST: `202 Accepted`). The user opens it, sees what will be deleted and which app asked, and confirms. Make the link single-use, short-lived (Linkly uses 15 minutes), and valid only for the same user, logged in to your app.
- **Let each connection choose:** the consent screen's confirmation toggle decides whether that app's deletions need a link.
- **Offer a reversible alternative,** such as archiving, and say so in the delete tool's description.

**Why:** a confirmation link works in every client, because it's just a URL in a result. MCP's elicitation, where the server asks the user a question mid-call, works only in clients that support it.

**Upgrade to [elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) where clients support it.** Since the 2026-07-28 spec, elicitation is stateless: instead of a result, the server returns the question, and the client asks the user and retries the same call with the answer. Any server instance can finish the retry. There are two modes:

- **Form mode:** the client shows a question, such as "Delete summer-sale?", and sends the answer back.
- **URL mode:** the client shows a URL of yours, asks the user's permission, and opens it.

For destructive actions, use URL mode. It's your confirmation link, opened by the client instead of passed along by the agent, so the user still confirms in their own logged-in session. That's stronger than a "yes" sent back by the client app. The flow:

1. The agent calls `delete_link`. The server creates the pending deletion as before, and returns an `input_required` result that points at the confirmation page, with a signed `requestState`:

   ```json
   {
     "resultType": "input_required",
     "inputRequests": {
       "confirm": {
         "method": "elicitation/create",
         "params": {
           "mode": "url",
           "url": "https://linkly.example.com/confirm/pa_123",
           "message": "Confirm deleting the link \"summer-sale\" in Linkly."
         }
       }
     },
     "requestState": "<signed: this user, pending deletion pa_123, expires in 15 minutes>"
   }
   ```

2. The client shows the URL, the user agrees, and the page opens. The user confirms there.
3. The client retries `delete_link` with the answer, `"inputResponses": { "confirm": { "action": "accept" } }`, and the same `requestState`. "Accept" only means the user agreed to open the page, so the server checks its own record: if the deletion was confirmed, it returns the final result. If the user declines, it withdraws the pending deletion and returns a normal result saying nothing was deleted.
4. Clients retry as soon as the page opens, usually before the user has confirmed. Don't ask again: wait briefly (Linkly checks for up to 20 seconds), then return `input_required` with only the `requestState`, and the client retries without prompting. Clients cap the rounds of one call (10 in the official SDKs), so cap the waiting too and then return the link.

Two rules:

- **Check the client's capabilities on every request.** Send a URL-mode request only when the request declares support for it. Every other client gets the link in the tool result, as before.
- **Treat `requestState` as input an attacker could have changed.** Sign it, bind it to the user and the pending deletion, give it an expiry, and keep the pending deletion single-use.

Linkly does this with the v2 MCP SDK, which speaks both 2026-07-28 and the older revisions from one endpoint. As of October 2026, few clients support it: the Claude Code CLI opens the page itself, Codex and OpenCode can with opt-in settings, and the chat apps (ChatGPT, Claude Desktop, claude.ai) don't yet. They get the link, so build the link first.

**Done when:** an agent's delete returns a link, and nothing is deleted until you open it and confirm. If you've made the upgrade, a client that supports URL-mode elicitation opens that same page itself, and its retry returns the result.

**In Linkly:** [`requestDeletion`](../src/links/service.ts), [`src/deeplinks/`](../src/deeplinks/), [`src/mcp/confirmations.ts`](../src/mcp/confirmations.ts).

## Step 7: Add a REST API with tokens and OpenAPI

Scripts, integrations, and your customers' own code want plain HTTP, and the CLI in Step 8 is generated from the OpenAPI document. If you already have a REST API, point its handlers at your operations.

**Do:**

- **Write thin route handlers:** read the token, build a principal, parse the request, call the operation, and turn its errors into status codes.
- **Add personal access tokens:**
  - random, with a recognizable prefix (`lk_pat_…`);
  - store only a hash, and show the raw value once;
  - each token has permissions, an optional expiry, and a revoke button;
  - sent as `Authorization: Bearer <token>`.
- **Generate an OpenAPI document from the same schemas** that validate requests, so it can't drift from the server. Declare each operation's required permission. HTTP methods only hint at risk (a `POST` can destroy data, and a `PATCH` can archive it), so mark destructive operations explicitly with an extension such as `x-destructive: true`.
- **Version the API** (`/api/v1`) so agents and scripts don't break when you change it.

**Why:** it reaches everything that doesn't speak MCP, and with the operations in place it's a thin layer. The CLI and discovery steps build on it.

**Done when:**

- `curl -H "Authorization: Bearer $TOKEN" https://myapp.com/api/v1/links` works.
- A token without the right permission gets `403`.
- The OpenAPI document validates.

**In Linkly:** [`src/links/rest.ts`](../src/links/rest.ts), [`src/tokens/service.ts`](../src/tokens/service.ts), [`src/shared/bearer.ts`](../src/shared/bearer.ts), [`src/openapi/document.ts`](../src/openapi/document.ts).

<!-- TODO (AGENT): check the claim here i think some desktop apps have shells, but then they need a sandbox, right? helpe me here. -->
## Step 8: Add a CLI, if your users have shells

**Do:**

- **Generate the client code from your OpenAPI document,** and give each operation a command that calls the REST API.
- **Follow six rules,** because agents get stuck without each one:
  1. **Never prompt.** An agent can't answer an interactive prompt, so the command just hangs. Missing input is a usage error that names the flag to add.
  2. **Destructive commands need `--yes`,** and the error says so: `Refusing to delete without --yes. Re-run: mycli links delete <id> --yes`.
  3. **Print JSON when piped,** in exactly the shape the API documents.
  4. **Send errors to stderr, with meaningful exit codes,** such as 2 for usage, 3 unauthorized, 4 forbidden, 5 not found, 6 conflict.
  5. **Write good `--help` with examples.** It's how an agent learns a CLI.
  6. **Keep no hidden state** beyond a config file only the user can read.
- **Handle login the way other CLIs do, and support more than one account:** a `login` command that takes a token, an environment variable that overrides it, and profiles or a config-directory switch for a second account. Every CLI inventing its own login is one of the real costs of CLIs compared with MCP, so make yours unsurprising.

**What CLIs do better:** they're easier to debug. A person can re-run the exact command the agent ran and see what happened. With MCP, replaying a call takes an inspector.

**Where this is heading:** some harnesses let the model call MCP tools from code, in a sandbox ("code mode"). The model writes one script that loops over 500 links, and only the final result comes back into its context. That gives agents the composability of a shell without needing one, and without its pitfalls. Where clients support it, it narrows the gap between MCP and a CLI.

**Skip if:** your users don't have shells. MCP covers them.

**Done when:**

- `mycli links list --json | jq` works.
- Every command finishes with stdin open and nothing written to it, instead of hanging.

**In Linkly:** [`cli/src/program.ts`](../cli/src/program.ts), [`cli/src/api.ts`](../cli/src/api.ts), [`cli/src/config.ts`](../cli/src/config.ts) (login with `linkly auth login --token`, or `LINKLY_TOKEN`; a second account with `LINKLY_CONFIG_DIR`).

## Step 9: Help agents find you from your domain alone

A user types "use myapp.com". The agent fetches your homepage. If it's a single-page app, the agent gets an empty shell with a script tag, and nothing to follow.

**Do:**

- **Put an `llms.txt` at the root of the domain people type,** and generate it when you build, so it can't go stale. Include only what your OpenAPI document can't say:
  - what your app is, in one paragraph;
  - the MCP URL, marked as the recommended way to connect;
  - the REST base URL and the OpenAPI URL;
  - how to log in: OAuth for clients that support it, otherwise ask the user for a token from your settings page;
  - two rules: never ask the user for their password, and ask before any destructive operation;
  - links to your docs.
- **Make the landing page and docs readable without JavaScript,** by prerendering or server-rendering them, and add a visible line such as "Using an AI agent? Point it at myapp.com/llms.txt".
- **Add a "Connect an AI agent" box** to your settings, with the MCP URL and a ready prompt to copy. A URL the user hands over is the most reliable signal of all.
- **Optionally,** serve your OpenAPI document at `/.well-known/openapi.json` and add a `Link: <…/openapi.json>; rel="service-desc"` header to API responses. These help code, but models rarely see response headers.

**Why tell agents never to ask for the password?** With a password, an agent could log in as the user and skip the consent screen entirely.

**Done when:**

- A plain fetch of your homepage, with no JavaScript, shows where to go.
- `/llms.txt` returns your MCP and OpenAPI URLs.

**In Linkly:** [`llmsTxt.ts`](../src/discovery/llmsTxt.ts), written into the client build by a small plugin in [`vite.config.ts`](../vite.config.ts); `prerender` on the homepage and docs routes, with a "For AI agents" card on the [homepage](../src/app/HomePage.tsx); a "Connect an AI agent" card on the [Connections page](../src/oauth/ui/ConnectionsPage.tsx); and the `service-desc` header, `/.well-known/openapi.json`, and the RFC 9727 `/.well-known/api-catalog` on the server. [`e2e/discovery.spec.ts`](../e2e/discovery.spec.ts) plays the agent, from the homepage to an API call. The reasoning is in [Discovery without MCP](ARCHITECTURE.md#discovery-without-mcp).

## Step 10: Keep the surfaces in sync

If you generate your surfaces from one declaration, most of this comes for free. If you write them by hand, add tests that fail when they drift:

- **Parity:** every dashboard operation maps to an MCP tool, or states why it's dashboard-only (for example, "consent has to come from the human"). Every tool has a CLI command, or a reason why not.
- **Safety flags agree:** an operation marked destructive is marked on every surface.
- **The published spec matches the server:** the committed OpenAPI document equals the one the server serves.
- **Descriptions are linted:** every tool has a title and a description that mentions related tools, every input field is described, and annotations are set.
- **End to end:** run the real OAuth flow in a test, with a small test client that serves its own metadata document and catches the redirect.

**Done when:** adding an operation to one surface and not the others fails CI.

**In Linkly:** [`parity.test.ts`](../src/mcp/parity.test.ts), [`cliParity.test.ts`](../tests/cliParity.test.ts), [`destructiveFlags.test.ts`](../tests/destructiveFlags.test.ts), [`drift.spec.ts`](../cli/test/drift.spec.ts), [`descriptions.test.ts`](../src/mcp/descriptions.test.ts), [`e2e/oauth.spec.ts`](../e2e/oauth.spec.ts).

## Small things agents notice

- **Accept the identifiers people use.** If users know a link by its slug, accept the slug or the ID.
- **Make every error say what to do next:** `Link "abc" not found. Use list_links to find valid IDs or slugs.`
- **Map each error the same way on every surface.** Linkly's "slug taken" is a toast in the dashboard, `409` in REST, a tool error in MCP, and exit code 6 in the CLI.
- **Use cursor pagination,** and tell the agent how to get the next page.
- **Return structured results,** not prose, so agents don't have to parse sentences.
- **Include a "who am I" operation** that returns the account, its permissions, and its settings, so an agent can check what it's allowed to do.

## Mistakes to avoid

- **Near-duplicate tools, one per endpoint variant.** The model has to choose between tools that do almost the same thing, and in clients that load every tool up front, each one takes up context.
- **One read-and-write permission for everything.** Users won't connect an agent they can't limit.
- **Permission checks only in the adapters.** The next surface you add will forget them.
- **Agents holding passwords.** A password skips consent and gets full access.
- **Interactive prompts in a CLI.** The agent waits forever.
- **Deleting on a single call from an agent.** Make it wait for the human.
- **Docs that only render with JavaScript.** Agents see an empty page.

## The case for MCP

Every surface can call the same tools: turn an MCP server into a CLI, and the tools don't change. So MCP's value isn't in what the tools can do. It's in how agents connect, who holds the credentials, what the client shows the user, and a few features the other surfaces have no equivalent for. Here's the full list, with the limits of each.

### Reach and setup

- **It works where there's no shell.** MCP is how chat, desktop, web, and mobile assistants connect to other services. Their alternatives are off by default, work in only one client, or make the user handle tokens.
- **A remote server needs nothing on the user's machine:** no install, no runtime, no sandbox. (A local MCP server needs a runtime, like a CLI does.)
- **Setup is pasting one URL.** The client finds the login from a `401`, needs no registration, and the user clicks Allow (Step 5). That replaces "create a token and explain the API to your agent."
- **One server works in every client.** The same URL works in chat apps, IDEs, and coding agents, with nothing to set up per client.
- **Every server logs in the same way.** A server that follows the spec uses the same OAuth flow as every other, while each CLI invents its own login and config. This holds only if you follow the spec.
- **Improvements reach everyone at once.** Fix a description or add a tool, and every connected agent gets it on its next connection. A CLI waits for users to upgrade.

### Security and control

- **The model never holds the token.** The client stores it, refreshes it, and attaches it only to requests to your server, so a prompt injection can't make the agent print it or send it somewhere else. A token in an environment variable stays out of the agent's context, but the agent can still use it anywhere.
- **Clients act on safety hints.** They run read-only tools without asking and ask before destructive ones. OpenAPI has no standard flag for this (Step 7 adds one), and a CLI declares nothing.
- **Approvals are readable.** "Allow `delete_link` with `id: summer-sale`?" is easier to judge than a raw `curl` command, and users can always allow just the read-only tools.
- **The set of actions is known.** A list of tools is easier to review and govern than a shell that can run anything. It's also why you can turn an MCP server into a CLI, but not a CLI into an MCP server.
- **The tool list follows the user's choices.** With a separate checkbox for each permission (Step 5), tools the user didn't grant disappear from the list. REST can enforce the same permissions, but it has no list to shrink.
- **Organizations can govern it.** Admins can allow or block connectors centrally in chat products, and your server sees every call, per connection.

### Agent ergonomics

- **Tools describe themselves.** On connect, the client gets every tool's name, description, and schemas, plus the server's instructions, with nothing to configure.
- **Arguments are checked against a schema.** The model fills in structured arguments instead of composing a method, path, headers, and body, which fails less often outside strong coding agents.
- **Clients can index and search the catalog.** A structured tool list is what tool search and lazy loading are built on, where a CLI's `--help` is free text. (An OpenAPI document is just as searchable, and this only helps in clients that search.)
- **Code mode builds on it.** Harnesses that run tools from code turn your tools and output schemas into typed functions. The model writes one loop, only the result comes back into its context, and the token stays with the harness (Step 8).
- **No shell pitfalls.** Nothing hangs waiting for interactive input, and there's no quoting or escaping to get wrong.
- **Docs can be resources.** The server can expose its docs for the client to browse and attach, alongside a docs-search tool (Step 4).

### Features the other surfaces don't have

- **Elicitation:** asking the user something mid-call. URL mode opens a page of yours, such as a confirmation page (Step 6).
- **MCP Apps:** UI inside the chat, such as a chart or a form.
- **Notifications:** telling the client that something changed, or pushing data into a running session.
- **Skills over MCP:** instructions for using your server, shipped with it (still being worked on).

Few clients support these yet (see [Status](#status-as-of-october-2026)), so give each one a fallback that works with tools alone (the table in Step 4).

### Where MCP doesn't win

- **Plain tools gain nothing over REST.** If your server only wraps endpoints, its value is the connection, login, and safety above, not new abilities. An OpenAPI document plus OAuth that accepts any client already serves most agents well.
- **Developers with a shell need less.** REST plus a CLI covers them. CLIs compose with other tools and are easier to debug, because a person can re-run the exact command.
- **Context cost depends on the client.** Clients that load every tool up front pay for each definition, used or not, which is one more reason to avoid near-duplicate tools.
- **Bulk work is slow without code mode.** "Tag 500 links" becomes 500 calls, with every result passing through the model.
- **It's still moving.** The spec changes, and clients support its newer features unevenly.

### Claims that don't hold up

- **"Only MCP supports multiple accounts."** Good CLIs have profiles too (`gh auth switch`, `aws --profile`).
- **"Every client loads tools lazily now."** Some do and some don't, and you can't choose your users' client.
- **"More tools is better," or "fewer is better."** Neither: cover every capability, with no near-duplicates (Step 4).

## Status, as of October 2026

The patterns above should hold for years. These details are still moving, so check the current specs:

- **MCP authorization:** the MCP spec recommends Client ID Metadata Documents. Its 2026-07-28 revision deprecates Dynamic Client Registration, keeping it only for backwards compatibility. CIMD is still an IETF draft, and client support varies.
- **The protocol became stateless** in the 2026-07-28 revision: no sessions and no `initialize` handshake, and elicitation works by returning the question and having the client retry the call. Clients and SDKs are still catching up.
- **Elicitation, MCP Apps, and notifications** work in some clients and not others. The tool-only fallbacks in Step 4 work everywhere. For URL-mode elicitation over 2026-07-28 (Step 6): the Claude Code CLI supports it, Codex and OpenCode only with opt-in settings, and ChatGPT, Claude Desktop, and claude.ai don't yet. ChatGPT supports form mode.
- **Code mode** (running tools from code in a sandbox): the Claude API can do it for tools you define, but not for tools from MCP connectors. Agent frameworks such as Goose support it, and some servers, such as Cloudflare's, run it on the server side. As far as public docs show, chat apps such as ChatGPT and Claude offer lazy loading of tools at most. (Claude Desktop's "Code" mode is something else: Claude Code inside the app.)
- **Skills over MCP:** ways to ship skills through an MCP server are being worked on. Check the current spec before relying on them.
- **`llms.txt`** is a convention some agents check. OpenAPI discovery at `/.well-known` is a proposal, with no agreed path yet.

## Go deeper

- [OAuth for agents, explained](OAUTH-FOR-AGENTS.md): how an MCP client logs in with no registration, step by step.
- [Linkly's architecture](ARCHITECTURE.md): every design decision in the reference app, and the code behind it.
- [Linkly's README](../README.md): run the reference app and connect an agent to it.
