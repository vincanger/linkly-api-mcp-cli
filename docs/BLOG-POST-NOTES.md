# Blog post: notes and structure

Working notes for a blog post on making any web app usable by AI agents. Source material: [GUIDE.md](GUIDE.md), [AGENT-READY-APPS.md](AGENT-READY-APPS.md), [OAUTH-FOR-AGENTS.md](OAUTH-FOR-AGENTS.md), and Linkly itself.

Status: second draft of the plan. Step numbers in the table below refer to the reordered GUIDE.md. Open questions are at the bottom, marked **Q**. The writing scaffold is [blog/draft.md](blog/draft.md).

## The thesis

> Agents are a new kind of user. Build one well-described set of operations, then expose it through an MCP server with OAuth. REST and a CLI are cheap adapters on the same operations: REST for software that isn't an agent, a CLI for people with shells.

Supporting claims, in the order the post makes them:

1. **Most of the work is one layer down.** If each action is one function with a good description, a schema, a permission, and an effect, every surface is a short adapter. If not, every surface re-implements the rules and they can drift.
2. **MCP is the default surface.** One server reaches coding agents (Claude Code, Cursor, Codex) and chat and desktop apps (Claude, ChatGPT). The user pastes one URL, logs in, picks permissions, and clicks Allow, and the client knows which tools are safe.
3. **OAuth is part of MCP, not an extra.** It's what makes the one-URL setup work everywhere. (OAuth with CIMD works for any API; MCP's edge is that every MCP client already runs the login.) It looks like a lot of moving parts, but it's standard and well specified, so a coding agent can build it from a reference: Linkly exists to be copied.
4. **Safety is a product feature.** Granular permissions and "deletes wait for the human" are why people will connect an agent to real data at all.
5. **REST and the CLI come almost free.** Same operations, thin adapters. REST is for software that isn't an agent: integrations, scripts, and your customers' code (or keep the one you have). Generate a CLI from its OpenAPI if your users have shells.

## Proposed structure

Target: ~5,000 words, plus code snippets and visuals/animations. Everything deeper links to GUIDE.md and the repo.

### 0. Hook (~200 words)

**Decided: a mix of A and B**, with C as the turn into the post. Ruled out: a before/after demo of an assistant using Linkly (too basic for this audience).

Beats:

1. **Agents are becoming users (A).** More people reach your product through an agent: a coding agent in a terminal, a chat assistant on a phone, a desktop agent given only your domain. They don't see your UI, so what they can do depends on what you expose and how well you describe it.
2. **The debate about what to expose (B).** API, CLI, or MCP? Bring in Rhys Sullivan as the clearest version of it: his [post on X](https://x.com/RhysSullivan/status/2070630745891365008) and his [article on X](https://x.com/RhysSullivan/status/2070311929038680262). Quotes to use, from the article:
   - On CLIs: "you can trivially convert from an MCP to a CLI, you cannot convert from a CLI to an MCP in that same way. CLIs also don't have the same annotations the MCP or OpenAPI specs do around what actions are destructive, although LLMs are getting good enough that this doesn't matter as much."
   - His end state: "the world i'd like to end up in is one where all companies support CIMD OAuth to their MCP server and their OpenAPI spec. the OpenAPI spec is able to be used for raw data access, bulk processing, and the MCP is able to provide a more curated experience with maybe a `api` tool similar to how the CLIs of Vercel and GitHub feel."
   - From the X post (as pasted into GUIDE.md; check the wording): APIs are a quick way to make your app agent-accessible, the formats convert into each other, and "APIs are probably fine for 90% of applications."
3. **Agree, then turn (C).** His end state is close to ours: CIMD OAuth in front of both, OpenAPI for raw and bulk access, MCP for the curated experience. And he's right that the formats convert into each other, though only from MCP down to a CLI, not back up. That's why the format isn't the real decision. What matters is the layer underneath (operations with good descriptions, permissions, and safety flags); once you have it, every surface is cheap. So the question is which surface to make the default, and our answer is MCP: it reaches both coding agents and chat apps, and it's the only one with features like elicitation and Events (section 3a). Clients are catching up faster than expected.

Note on the "good OpenAPI spec, then MCP and a CLI on top" idea: the closest thing Rhys says is the end-state quote above (OpenAPI and MCP side by side, both behind CIMD OAuth). The "generate MCP and a CLI from OpenAPI" version is the common tip covered in [AGENT-READY-APPS.md](AGENT-READY-APPS.md#the-openapi-shortcut); don't attribute it to him.

Whichever it is, it ends with the promise: here's what to build, in what order, and how to tell each step is done.

### 1. The short answer (~250 words)

The order, as a numbered list a reader can screenshot:

1. Put logic in operations, with metadata for agents.
2. An MCP server over those operations, with OAuth and a checkbox per permission.
3. Destructive actions wait for the human.
4. A REST API with tokens and a generated OpenAPI document, for software that isn't an agent: integrations, scripts, your customers' code.
5. A CLI generated from OpenAPI, if your users have shells.

Then: "Steps 1–3 reach every agent your users have. Steps 4–5 are cheap once 1 is done." Plus one line so REST doesn't read as an afterthought: agents will need a raw API less and less, but most of what calls APIs today isn't an agent (details in section 7).

### 2. The mental model: operations and surfaces (~300 words)

The two-layer diagram from GUIDE.md. Your dashboard is just another surface. This is the section people should remember.

Visual: the "Four Ways In" animation, or a still of it.

### 3. Which surfaces do you need? (~650 words)

A short decision table (MCP / REST / CLI × who it reaches, when to add it), then the debate:

- They're interchangeable for plain tool calls. What changes is where the agent runs, who holds the credentials, and which interaction features exist.
- Credit and engage [Rhys Sullivan's take](https://x.com/RhysSullivan/status/2070630745891365008). Say where we agree (APIs are good for raw access; CLIs are great today *for agents with a shell*; MCP's interaction features are the future) and where we land differently (start with MCP, because it's the one surface that reaches every kind of agent).
- Our position: MCP with OAuth first, because it reaches both coding agents and chat apps. REST for scripts and integrations. A CLI last, because it only reaches people with a shell on their own machine.

**Why MCP first, firmed up** (~200 more words for this section). Don't rest the case on "agents without a shell": Claude Desktop has Claude Code built in, ChatGPT and claude.ai run code in sandboxes, and coding agents live in shells. Having a shell doesn't give an agent access to your app. The real question is how a user safely hands an agent access to their account, and whether the agent's client knows what each action does. Reasons, strongest first:

1. **Credentials, not shells.** With a CLI in a chat app's sandbox, the user creates a token, pastes it into the chat (where the model can read it, print it, or send it elsewhere), and gets the CLI into a sandbox that may be wiped or blocked from the network. With MCP: paste one URL, log in, click Allow. The client stores and refreshes the token and sends it only to your server; the model never sees it.
2. **The user sets the limits, and can change them.** A checkbox per permission at connect time, and a Connected apps page to narrow or revoke, applied on the next call. Token scopes exist too, but the user has to know to set them.
3. **The client knows what each action does.** Read-only and destructive hints let clients run reads without asking and ask before deletes, with readable approvals ("Allow `delete_link` with `id: summer-sale`?"). To a client, a shell command is just "run bash." (Rhys makes the same point about CLIs lacking destructive annotations.)
4. **Features a shell can't have:** elicitation, MCP Apps, Events (section 3a). The forward-looking reason.
5. **MCP converts down to a CLI, not back up** (Rhys's quote). Starting with MCP keeps every option open.
6. **One URL works in every client, and fixes reach everyone** on the next call; connector directories and admin controls come with it. A CLI fix waits for upgrades.

**Be precise about OAuth.** OAuth with CIMD isn't unique to MCP: a REST API can serve the same `401` pointer and metadata and accept CIMD client IDs. MCP's edge is on the client side: every MCP client already runs the login, because the spec requires it, so connecting takes one URL. For a REST API or a CLI, someone still has to build the client side every time (each CLI its own login; a coding agent with `curl` won't run a browser OAuth flow for a service it just found). If agent clients start doing this for any OpenAPI service, the gap narrows; that's Rhys's end state, and it's worth saying so.

**Concede:** in a coding agent with a real shell, a good CLI is excellent (composable, easy to debug); bulk work favors code, and code mode only partly closes that gap so far. The message is "don't start with a CLI," not "don't build one."

Summary to adapt: most agents have a shell now, but that's not the question. The question is how your user hands an agent access in one step, with limits they chose, and actions their client can tell apart. **Verify before publishing:** the current network rules for the ChatGPT and claude.ai sandboxes.

**Side-by-side: raw access and bulk work vs. a curated experience** (~250 words of the section). Illustrates Rhys's line: "the OpenAPI spec is able to be used for raw data access, bulk processing, and the MCP is able to provide a more curated experience." The difference is who does the work: code the agent writes, or the model calling tools one at a time.

| Task (Linkly) | OpenAPI + a script | MCP tools | MCP with code mode in the client |
|---|---|---|---|
| **Raw access:** "Export all my links and click counts to a spreadsheet" | A loop over `GET /api/v1/links?cursor=…` writes a CSV. The model sees only "Wrote 10,000 rows." | 200 `list_links` calls, and every link passes through the model's context. | **Matches the script:** the model writes one loop over `list_links`, and only the result comes back. |
| **Bulk processing:** "Tag every link to example.com as `partner`" | List, filter, then `PATCH` each match. Seconds, and a person can rerun it. | 300 `update_link` calls, each a round trip through the model. | **Matches the script:** one loop over `update_link`, and the token stays with the client. |
| **Curated:** "How did my launch links do last week? Delete the one that flopped." | The agent works out the endpoints and reads raw numbers. Needs a shell and a token. A token-authed `DELETE` asks no one. | One `get_link_stats(groupBy: day)` call, guided by its description, with a link to the chart. The delete is marked destructive and waits for the user's confirmation (elicitation). | Same as MCP tools, and the safety hints and confirmations still apply per call. |

Takeaways:

- Most requests are the curated kind: a question or a small action in a chat. That's why MCP is the default.
- Raw and bulk work favor code. Today that means OpenAPI plus a script in a shell or sandbox. **Where the client supports code mode, MCP matches it,** so the gap closes as clients adopt it. Few do yet (check the status box in section 12).
- Where this is heading: for agents, code mode covers bulk work and Events cover reacting to changes like a webhook. So agents will need a raw API less and less. REST doesn't go away, though; it becomes the surface for software that isn't an agent (section 7).
- Rhys's `api` tool is the other way to close the gap: curated tools plus one raw tool inside MCP (see "Two ideas from Rhys's article" below).

Format: a table in the post, or a three-column graphic.

### 3a. What only MCP can do (~600 words)

The second reason for MCP first, after reach. For plain tool calls, MCP, REST, and a CLI are interchangeable. These features are where MCP goes further: the server can talk to the *human* and to the *agent*, not just answer calls. Neither an API nor a CLI has a channel for that.

- **Elicitation: ask the human mid-call.** The server pauses a tool call and the client asks the user, as a form (a question and an answer) or a URL (opens a page of yours). An API can only return an error, and a CLI can't prompt without the agent hanging. **This is the worked example for 3a:** Linkly's deletions open the confirmation page through URL-mode elicitation in Claude Code. Show the screenshot here; the mechanics stay in section 6.
- **MCP Apps: UI inside the chat.** A tool returns an interactive widget instead of JSON: a chart of your analytics, a form prefilled with what the user asked for, a picker. An API returns data and a CLI prints text; the agent then has to describe it. Describe it, with no example for now. (Vince has an MCP Apps example from another app to add later; not part of this draft.) Linkly's fallback is a link to the matching dashboard view.
- **MCP Events: your server tells the agent when something happens.** Like webhooks, but the subscriber is an agent that acts on it: "tell me when this link passes 1,000 clicks, then post it in Slack." The user asks once, the client subscribes through your server, and your server notifies it when it fires, with no one in the chat.
  - **Status:** ChatGPT added support on 2026-09-29, with webhook delivery: the server implements `events/list`, `events/subscribe`, and `events/unsubscribe`, advertises events in `server/discover`, and signs each delivery with Standard Webhooks HMAC. The spec itself is still a draft from MCP's Triggers & Events Working Group, which also covers poll and push delivery. ([mixed-news](https://mixed-news.com/en/chatgpt-mcp-events-webhooks-draft-spec-work-chats/), [working group design sketch](https://github.com/modelcontextprotocol/experimental-ext-triggers-events/blob/main/docs/design-sketch-proposal.md))
  - **A safety angle that fits the post:** a subscription keeps acting after the chat ends, so treat it like a credential: tie it to the grant, list it on the Connected apps page, and cancel it when the user disconnects or narrows permissions ([WorkOS on this](https://workos.com/blog/mcp-events-chatgpt-subscription-revocation)).
  - Described only; no Linkly example.
- **Notifications** (smaller): the server tells the client its tool list or a resource changed.

**The catch, said plainly:** client support is uneven, so each feature needs a fallback that works with tools alone (the table in section 5).

**But it's moving fast, and that's the point to end on.** These three are examples, not the full list. They're being adopted quickly: URL-mode elicitation went from spec to Claude Code, and Events went from a draft to shipping in ChatGPT, within months. Expect more features like them that we can't predict yet. Building on MCP now means getting each one as clients ship it, which an API or a CLI never will. Close the section on the outlook: whatever people first thought of MCP, its future looks very bright.

Tone: confident, not hype. The dates and the support table back the claim, so let the evidence carry it. This also answers Rhys's point that MCP's potential depends on clients catching up: they are catching up, quickly. Build the fallback now, and the feature lights up when clients ship it.

To check: the time from spec to client support for elicitation (form and URL mode) and for Events, so "within months" is accurate.

Visual: a small support table (feature × Claude Code, Claude apps, ChatGPT, Codex, Cursor), dated. **Verify every cell before publishing.**

**Two ideas from Rhys's article to address somewhere (section 3, 5, or 7):**

- **OAuth for the REST API too, not just tokens.** His end state puts CIMD OAuth in front of the OpenAPI spec as well, and the protocol allows it: the same OAuth server, grants, and consent screen can sit in front of `/api/v1` and `/mcp`. Third-party apps and CLIs get the same login; personal access tokens stay for scripts. Linkly's bearer check already accepts OAuth tokens issued for `/api/v1` ([`bearer.ts`](../src/shared/bearer.ts)). The catch is the client side: unlike MCP clients, nothing runs this login automatically for a REST API, so each app or CLI builds it. Worth one paragraph in section 7. GUIDE.md's Step 7 only covers tokens. *(Check what Linkly's metadata advertises for `/api/v1` before claiming it works end to end.)*
- **An `api` escape-hatch tool on the MCP server,** like `gh api` or `vercel api`: curated tools for common tasks, plus one tool that calls any REST endpoint. It sits awkwardly with our rule about not merging tools across a permission or risk boundary: the client can't tell a read from a delete inside it, just like Cloudflare's `execute()`. If the post mentions it, give the tradeoff: permissions and confirmations still apply because they're checked in the operations, but per-tool safety hints don't.

### 4. Step 1: Operations, described for agents (~500 words)

Merges GUIDE steps 1–3.

- One function per action, signature `(caller, input, deps)`, no HTTP or MCP inside.
- The five fields: name, description written for an agent, schemas with every field described, permission, effect (read/write/destructive). Show the table.
- Permissions: one list, checked inside the operation, split by resource and access level. "Write includes read."
- Snippet: `createLink` with `requirePermission`.

Tip to call out: a good description says when to use this tool *instead of* a related one, and what to do after common errors.

**Retrofitting an existing app** (new, ~300 words; not in GUIDE.md yet). Most readers have logic inside controllers, server actions, or UI code. Suggested path:

- Pick the 3–5 actions agents will use most (usually: list, get, create, update, and the one action your product is for).
- Extract each into an operation with the `(caller, input, deps)` signature, and point the existing dashboard handler at it first. Nothing user-visible changes, so it's safe to ship.
- Add the permission check and the metadata as you extract, not later.
- Expose only those operations as tools. Add the rest as people ask, with the parity test (section 11) listing what's still dashboard-only.

Needs: one before/after snippet of a controller turning into an operation.

### 5. Step 2: An MCP server with OAuth (~1,100 words, the core of the post)

Merges GUIDE steps 5 and 6. OAuth is presented as the standard way to connect, not an upgrade. No token-auth MCP.

**The server:**

- Stateless `POST /mcp`, one thin tool per operation calling the same function the dashboard calls.
- Tool design tips, as a punchy list:
  - Cover every capability, no near-duplicates; variations become parameters (`groupBy`, `view`).
  - Don't merge across a permission or risk boundary (`manage_link(action=…)` is the anti-pattern).
  - List only the tools the connection's grant allows.
  - Set `readOnlyHint` / `destructiveHint`, declare output schemas, write server instructions.
  - Return a link to the item in your app, and a tool that builds links to any view.
  - A docs-search tool.
- The fallback table for section 3a's features: elicitation → confirm URL, MCP Apps → dashboard link, Events → the user asks again or checks the dashboard, notifications → rebuild on next request.

**Connecting, with OAuth:**

- The user-visible flow: paste URL → browser opens → choose permissions → Allow. Same in Claude Code and in claude.ai.
- The moving parts, briefly: `401` with a pointer to your metadata, CIMD (no registration, no allowlist), a consent screen with one checkbox per permission, short-lived tokens, a "Connected apps" page where changes apply on the next request.
- How to build it: use your auth provider if it supports MCP auth (name a few), or have your coding agent build it from Linkly's `src/oauth/` and [OAUTH-FOR-AGENTS.md](OAUTH-FOR-AGENTS.md). Don't dwell on its size.

**CIMD, briefly** (a few sentences in the post). Rhys's end-state quote names "CIMD OAuth," so say what it is, without going deep:

- It's how an app tells your server who it is: the `client_id` is a URL pointing to a small JSON document on the app's domain. No registration step.
- The current MCP spec (2026-07-28) recommends it and deprecates Dynamic Client Registration. (CIMD itself is still an IETF draft, so say "the spec recommends," not "the standard.")
- **The point to make:** if every company supports CIMD, any agent can connect to any service without a developer setting anything up first.
- Builders get the details from [OAUTH-FOR-AGENTS.md](OAUTH-FOR-AGENTS.md) and Linkly's [`cimd.ts`](../src/oauth/cimd.ts) / [`ssrf.ts`](../src/oauth/ssrf.ts); the post doesn't need DCR's weaknesses or SSRF.

Visual: screenshot of the consent screen.

### 6. Step 3: Destructive actions wait for the human (~400 words)

- Confirmation link: single-use, short-lived, same logged-in user. Works in every client.
- Per-connection toggle on the consent screen.
- URL-mode elicitation as the upgrade: one paragraph and a screenshot of Claude Code opening the page. Link to GUIDE.md for the `input_required` / `requestState` flow rather than reproducing it.

### 7. Step 4: A REST API, for software that isn't an agent (~500 words)

**Framing:** not "for agents that need raw access," but "for software that isn't an agent." You probably won't need a raw API for agents much longer. You'll still need one for everything else, and that's most of what calls APIs today. With the operations in place it's cheap, so keeping it costs little, and agents get a fallback while code-mode support is still thin.

**Why a raw API stays necessary** (a short list in the post):

1. **Not every caller is an agent.** Zapier, a customer's backend syncing data nightly, a data warehouse import, a partner integration, your own mobile app. These are deterministic programs that want plain HTTP with no model in the loop. They could call MCP through an MCP client SDK, but nobody writing a cron job will pick that over `fetch` and an SDK generated from OpenAPI.
2. **HTTP has decades of tooling.** SDK generators, API gateways, caching, rate limiting, observability, security reviews, and enterprise procurement all assume REST and OpenAPI. MCP runs over HTTP too, but it's shaped for model clients, and that ecosystem doesn't treat it as a general-purpose API yet.
3. **Heavy data.** Large exports, file uploads and downloads, streaming. MCP results are meant to be read by a model and have practical size limits; a REST endpoint can stream a 2 GB CSV.
4. **Stability.** REST with `/v1` is boring and settled. MCP has had several spec revisions in a year (stateless in 2026-07-28, Events still a draft). Integrations that must not break want the boring option.
5. **Agent features often run on OpenAPI anyway.** Cloudflare's server-side code mode runs the model's code against its OpenAPI document, and Rhys's `api` escape-hatch tool calls REST endpoints.

**The rest of the step:**

- Who it's for, concretely: integrations (Zapier, webhooks), scripts, customers' own code, your mobile app, and the CLI. Many readers already have one; then this step is "point it at the operations."
- Thin handlers over the same operations.
- Personal access tokens: prefix, hash-only storage, shown once, scopes, expiry, revoke.
- OpenAPI generated from the validation schemas; `x-destructive` because HTTP verbs don't tell you risk.

### 8. Step 5: A CLI, if your users have shells (~350 words)

- Generated from OpenAPI, so it's cheap.
- The six rules (never prompt, `--yes`, JSON when piped, stderr + exit codes, `--help` with examples, no hidden state).
- Login like other CLIs; profiles.
- One line on code mode as where this is heading.

### 9. Test with real clients, and with a model (new, ~400 words)

Not in GUIDE.md yet.

- **The dev loop:** MCP Inspector to call tools by hand; Claude Code against `localhost` (local clients reach it directly); a tunnel for claude.ai and ChatGPT, which need a public HTTPS URL. Note which clients are strict about what (OAuth metadata, CIMD vs. DCR, capabilities).
- **Test the descriptions on a model.** Write 10–20 realistic prompts ("archive everything tagged `old`") and check that a model picks the right tool with the right arguments. Linkly lints descriptions ([`descriptions.test.ts`](../src/mcp/descriptions.test.ts)) but doesn't run them past a model, so this is new.
- **Run the real OAuth flow in CI** ([`e2e/oauth.spec.ts`](../e2e/oauth.spec.ts)).

Needs: an example eval, even a tiny one. Could be added to Linkly first.

### 10. Risks that come with agent callers (new, ~400 words)

Not in GUIDE.md yet.

- **Prompt injection through your own data.** Tool results contain user content (a link's title, a note). An agent reading it can follow instructions planted there. Defenses: return structured results, keep destructive actions behind the human (step 3), and keep scopes narrow.
- **Retries and loops.** Agents retry aggressively. Rate-limit per connection, return `429` with a retry hint, and accept idempotency keys on creates.

### 11. Small things agents notice, mistakes to avoid, and keeping it in sync (~400 words)

Merge GUIDE's two lists into one scannable list. Then one paragraph on drift: generate surfaces from one declaration, or write them by hand and add parity tests. Link to Linkly's tests.

### 12. Where this is going (~200 words, dated)

A dated box: stateless MCP (2026-07-28), CIMD replacing DCR, uneven client support for elicitation and Apps, MCP Events (shipped in ChatGPT, spec still a draft), code mode. "The patterns hold; these details move."

### 13. Close (~150 words)

Link to the repo, GUIDE.md, and the explainers. Point out that Linkly is meant to be handed to a coding agent as a reference. A short note that it's built with Wasp, and where Wasp is heading.

## What to keep, condense, or cut from GUIDE.md

| GUIDE section | For the post | Why |
|---|---|---|
| Checklist + levels | Replace with the five-step order | The post folds steps 1–3 into one and drops discovery and sync tests from the main list |
| Mental model | Keep as is | The core idea |
| Which surfaces (Rhys notes) | Rewrite completely, with credit | Currently pasted notes, and partly contradicts our position (Rhys: "CLIs are just for humans long-term") |
| Steps 1–3 | Merge into one section | Three steps about one layer |
| Step 7 REST | Shorten | Now after MCP in both the guide and the post |
| Steps 4 + 5 (MCP, OAuth) | Merge into one MCP + OAuth section | One step: a server people can connect to |
| Step 4 code mode / Cloudflare paragraph | Cut to one sentence or a footnote | A tangent for a reader building their first MCP server |
| Step 4 toolsets | Cut or one line | Optional, and few clients use it |
| Step 5 OAuth security details (PKCE, refresh rotation, SSRF guards) | One sentence + link | A checklist for whoever builds it, not blog prose |
| Step 6 elicitation JSON and the 4-step retry flow | Cut, link to GUIDE | Too deep; most readers' clients don't support it yet |
| Step 8 CLI | Keep, shorten, last | Only reaches people with shells |
| Step 9 discovery | Cut to a "bonus" paragraph or drop | Not built in Linkly, `llms.txt` is a convention, `/.well-known/openapi` is a proposal |
| Step 10 parity tests | One paragraph | Valuable but not exciting |
| Small things + mistakes | Merge into one list | Very shareable |
| The case for MCP | Pick the best 4–5 points | Supports the MCP-first thesis; the full list stays in GUIDE.md |
| Where MCP doesn't win | One or two lines | Keeps the post honest |
| Claims that don't hold up | Keep, maybe as a callout | Good contrarian hook |
| Status box | Keep, dated | Readers need to know what's moving |

## What's missing from the guide

Things a reader will want that the guide doesn't cover yet. Items 1, 2, 3, and 4 go in the post (sections 4, 9, and 10); the rest go back into GUIDE.md or the asset list.

1. **A retrofit path for existing apps.** The guide reads as greenfield. Most readers have logic inside controllers or React Query hooks. How do you extract operations incrementally?
2. **How to test with real clients.** The dev loop: MCP Inspector, Claude Code against localhost, a tunnel for claude.ai and ChatGPT. Which clients are fussy about what.
3. **Checking your descriptions with a real model.** Does the agent pick the right tool for 10 typical prompts? The guide lints descriptions but never tests them on a model.
4. **Agent-specific risks:** prompt injection through your own data, retries and idempotency, result size.
5. **Observability.** Log tool calls per connection so you can see what agents actually do, which tools fail, and which descriptions confuse them.
6. **Concrete tool names.** The guide avoids naming libraries. A blog post can name a few: OpenAPI generators from code, spec-first generators, auth providers with MCP support. Needs a check for what's current.
7. **Versioning tools.** What happens when you rename a tool or change its schema? REST has `/v1`; MCP has nothing equivalent.
8. **Screenshots.** Consent screen, Connected apps, Claude Code's elicitation prompt.
9. **MCP Events.** GUIDE.md only mentions "notifications" and "pushing data into a running session." It should cover Events: subscriptions, webhook delivery, ChatGPT's support, and revoking subscriptions with the grant. Goes in the post (section 3a) and in GUIDE.md.

## Open TODOs in GUIDE.md, and suggested answers

- **Line 16, move the CLI later?** Done: GUIDE.md now runs operations → MCP → OAuth → confirmations → REST → CLI → discovery → sync tests, with "Start with token auth" removed and the levels rewritten.
- **Line 46, the Rhys section.** Rewrite in our voice, credit and link the post, quote one or two lines directly. Draft for section 3 above.
- **Line 74, the surface bullets.** Done: they now lead with "Start with MCP," with REST for scripts and integrations and the CLI as nearly free from OpenAPI.
- **Line 315, do desktop apps have shells?** Partly. Claude Desktop's Code tab is Claude Code, so it has the user's real shell. Chat apps (claude.ai, ChatGPT) run code in a remote sandbox: it can't see the user's machine or config, it may not have network access, and installing your CLI and getting a token into it is on the user. So "if your users have shells" holds, if we say "a shell on their own machine." **Verify the current sandbox network rules before publishing.**

## Assets

- Existing: "Linkly's Four Ways In" animation, the OAuth flow explainer (`docs/oauth-flow-explainer.html`), `docs/imgs/`.
- Needed: consent screen screenshot, Connected apps screenshot, Claude Code elicitation screenshot, a decision table graphic.

## Decisions

- **Audience:** web developers with a product *and* technical founders deciding what to build. So each step needs both the "why and in what order" (for founders) and a snippet or "done when" (for developers).
- **Format:** one long, definitive guide (~5,000 words), with GUIDE.md and the repo as the deep-dive appendix.
- **Order:** operations first, then MCP with OAuth as the default surface, then confirmations, then REST and a CLI as cheap adapters.
- **OAuth:** the standard way to connect to MCP. No token-auth MCP in the post. Don't emphasize how much code it takes: coding agents can build it, and Linkly is the reference to copy.
- **Wasp:** a light mention. Linkly is built with Wasp; one short note at the end on where Wasp is heading.
- **CLI:** optional and last. Nearly free from OpenAPI, so do it if it's cheap, but don't start there.
- **GUIDE.md matches the post's order** (done 2026-10-06): operations → MCP → OAuth → confirmations → REST → CLI → discovery → sync tests. Token-auth MCP is removed.
- **REST's role:** for software that isn't an agent (integrations, scripts, customers' code), not for agents that need raw access. Agents will need it less as code mode and Events spread; it stays cheap to keep.
- **Hook:** agents as users (A), then Rhys's debate (B), then the turn: the formats convert into each other, so build the operations layer and make MCP the default (C).
- **MCP-only features get their own section** (3a): elicitation, MCP Apps, and MCP Events, each with its tool-only fallback. Elicitation is the one worked example, since Linkly has it. Apps and Events are described without examples; nothing new gets built into Linkly for the post.
- **Gaps to cover in the post:** retrofitting an existing app (section 4), testing with real clients and a model (section 9), and agent-specific risks (section 10).

## Open questions

- **Q1. Rhys's quotes:** check the X post quotes (pasted into GUIDE.md) against [the original](https://x.com/RhysSullivan/status/2070630745891365008).
- **Q2. Where it's published,** and does it need a TL;DR thread or video version?
