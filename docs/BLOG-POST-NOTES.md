# Blog post: notes and structure

Working notes for a blog post on making any web app usable by AI agents. Source material: [GUIDE.md](GUIDE.md), [AGENT-READY-APPS.md](AGENT-READY-APPS.md), [OAUTH-FOR-AGENTS.md](OAUTH-FOR-AGENTS.md), and Linkly itself.

Status: first draft of the plan. Open questions are at the bottom, marked **Q**.

## The thesis

> Agents are a new kind of user. Give them one well-described set of operations, then expose it in order: a REST API first, an MCP server second, a CLI if it's cheap.

Supporting claims, in the order the post makes them:

1. **Most of the work is one layer down.** If each action is one function with a good description, a schema, and a permission, every surface is a short adapter. If not, every surface re-implements the rules and they drift.
2. **REST + tokens + generated OpenAPI is the baseline.** It gets coding agents and scripts today, and it's what the CLI is generated from.
3. **MCP is how non-developers reach you.** For plain tools it adds no new abilities over REST. Its value is the connection: paste one URL, log in, click Allow, and the client knows which tools are safe.
4. **The CLI is nearly free once you have OpenAPI**, and coding agents like it. It isn't required, and it's the step people over-invest in.
5. **Safety is a product feature.** Granular permissions and "deletes wait for the human" are why people will connect an agent to real data at all.

## Proposed structure

Target: ~4,000–4,500 words (up from 3,500 with the retrofit, testing, and risks sections), plus code snippets and 3–4 visuals. Everything deeper links to GUIDE.md and the repo.

### 0. Hook (~200 words)

Not decided. Three options to draft and compare. Ruled out: a before/after demo of an assistant using Linkly (too basic for this audience).

**Option A: agents are becoming users.** More people will reach your product through an agent: a coding agent in a terminal, a chat assistant on a phone, an agent given only your domain. They don't see your UI, so what they can do depends on what you expose and how well you describe it. Sets up the whole post as "designing for a new kind of user."

**Option B: Rhys's points, as the way in.** Open on [Rhys Sullivan's post](https://x.com/RhysSullivan/status/2070630745891365008): APIs are fine for most apps, CLIs are the best agent interface today, MCP has the most potential but needs clients to catch up. Agree with the framing, then take a position: which to build and in what order. *(Which of his points to lead with: still to confirm.)*

**Option C: the surface debate is the wrong argument, backed by Linkly's numbers.** For plain tool calls, MCP, CLI, and API are interchangeable. The hard part is letting people connect safely. Numbers (non-test source, from the repo):

- Creating a link is **one line** in the REST handler ([`rest.ts`](../src/links/rest.ts)) and **one line** in the MCP tool ([`mcp.ts`](../src/links/mcp.ts)). Both call the same `createLink`.
- The whole MCP layer (`src/mcp/`) is **~470 lines**.
- OAuth (`src/oauth/`) is **~1,180 lines**, about 320 of them consent and connections UI: **2.5× the MCP layer**.
- The CLI is **~400 hand-written lines** on top of ~860 generated from OpenAPI.

Possible line: "Linkly's MCP tool for creating a link is one line long. Its OAuth server is nearly 1,200." If C isn't the opening, these numbers still belong in the OAuth section.

The options combine: A or B for the opening paragraph, C's numbers later as evidence.

Whichever it is, it ends with the promise: here's what to build, in what order, and how to tell each step is done.

### 1. The short answer (~250 words)

The ladder, as a numbered list a reader can screenshot:

1. Put logic in operations, with metadata for agents.
2. REST API + personal access tokens + generated OpenAPI.
3. MCP server over the same operations, with token auth first.
4. OAuth so anyone can connect from a chat app, with a checkbox per permission.
5. Destructive actions wait for the human.
6. A CLI generated from OpenAPI, if your users have shells.

Then the minimum: "If you do only three things: REST + OpenAPI, a thin MCP server, and OAuth that accepts any client."

### 2. The mental model: operations and surfaces (~300 words)

The two-layer diagram from GUIDE.md. Your dashboard is just another surface. This is the section people should remember.

Visual: the "Four Ways In" animation, or a still of it.

### 3. Which surfaces do you need? (~400 words)

A short decision table (REST / MCP / CLI × who it reaches, what it costs), then the honest version of the debate:

- They're interchangeable for plain tool calls: MCP → CLI → MCP. What changes is where the agent runs, who holds the credentials, and which interaction features exist.
- Credit and engage [Rhys Sullivan's take](https://x.com/RhysSullivan/status/2070630745891365008): APIs are fine for most apps, CLIs are the best agent interface *today* thanks to bash, MCP is where the interaction features live (elicitation, Apps, notifications) but clients lag. Say where we agree and where we land differently.
- Our position: REST is non-negotiable; MCP is next because it's the only one that reaches chat apps; CLI last because it only reaches people with shells.

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
- Expose only those operations on REST and MCP. Add the rest as people ask, with the parity test (section 11) listing what's still dashboard-only.

Needs: one before/after snippet of a controller turning into an operation.

### 5. Step 2: REST API with tokens and OpenAPI (~400 words)

- Thin handlers.
- PATs: prefix, hash-only storage, shown once, scopes, expiry, revoke.
- OpenAPI generated from the validation schemas; `x-destructive` because HTTP verbs don't tell you risk.
- "Done when" as a `curl` one-liner.

### 6. Step 3: MCP server, token first (~800 words, the meatiest section)

- Stateless `POST /mcp`, one thin tool per operation, token auth via `claude mcp add --header`.
- Tool design tips, as a punchy list:
  - Cover every capability, no near-duplicates; variations become parameters (`groupBy`, `view`).
  - Don't merge across a permission or risk boundary (`manage_link(action=…)` is the anti-pattern).
  - List only the tools the connection can use.
  - Set `readOnlyHint` / `destructiveHint`, declare output schemas, write server instructions.
  - Return a link to the item in your app, and a tool that builds links to any view.
  - A docs-search tool.
- The fallback table: elicitation → confirm URL, MCP Apps → dashboard link, notifications → rebuild on next request.

### 7. Step 4: OAuth, so anyone can connect (~500 words)

Keep it conceptual and link out to OAUTH-FOR-AGENTS.md for the mechanics.

- The user-visible flow: paste URL → browser opens → choose permissions → Allow.
- The three moving parts: `401` with a pointer, CIMD (no registration, no allowlist), a consent screen with one checkbox per permission.
- "Use your auth provider if it supports MCP auth." Name a few.
- Connected apps page; changes apply on the next request.

Visual: screenshot of the consent screen.

### 8. Step 5: Destructive actions wait for the human (~400 words)

- Confirmation link: single-use, short-lived, same logged-in user. Works in every client.
- Per-connection toggle on the consent screen.
- URL-mode elicitation as the upgrade: one paragraph and a screenshot of Claude Code opening the page. Link to GUIDE.md for the `input_required` / `requestState` flow rather than reproducing it.

### 9. Step 6: A CLI, if your users have shells (~400 words)

- Generated from OpenAPI, so it's cheap.
- The six rules (never prompt, `--yes`, JSON when piped, stderr + exit codes, `--help` with examples, no hidden state).
- Login like other CLIs; profiles.
- One line on code mode as where this is heading.

### 9a. Test with real clients, and with a model (new, ~400 words)

Not in GUIDE.md yet.

- **The dev loop:** MCP Inspector to call tools by hand; Claude Code against `localhost` (local clients reach it directly); a tunnel for claude.ai and ChatGPT, which need a public HTTPS URL. Note which clients are strict about what (OAuth metadata, CIMD vs. DCR, capabilities).
- **Test the descriptions on a model.** Write 10–20 realistic prompts ("archive everything tagged `old`") and check that a model picks the right tool with the right arguments. Linkly lints descriptions ([`descriptions.test.ts`](../src/mcp/descriptions.test.ts)) but doesn't run them past a model, so this is new.
- **Run the real OAuth flow in CI** ([`e2e/oauth.spec.ts`](../e2e/oauth.spec.ts)).

Needs: an example eval, even a tiny one. Could be added to Linkly first.

### 9b. Risks that come with agent callers (new, ~400 words)

Not in GUIDE.md yet.

- **Prompt injection through your own data.** Tool results contain user content (a link's title, a note). An agent reading it can follow instructions planted there. Defenses: return structured results, keep destructive actions behind the human (step 5), and keep scopes narrow.
- **Retries and loops.** Agents retry aggressively. Rate-limit per connection, return `429` with a retry hint, and accept idempotency keys on creates.
- **Result size.** The agent pays context for every byte. Small default page sizes, summary fields in lists and detail in `get`, and truncation that says how to get the rest.

### 10. Small things agents notice, and mistakes to avoid (~300 words)

Merge the two GUIDE lists into one scannable list. Good shareable section.

### 11. Keep it from drifting (~150 words)

One paragraph: generate from one declaration, or write by hand and add parity tests. Link to Linkly's tests.

### 12. Where this is going (~200 words, dated)

A dated box: stateless MCP (2026-07-28), CIMD replacing DCR, uneven client support for elicitation and Apps, code mode. "The patterns hold; these details move."

### 13. Close (~150 words)

Link to the repo, GUIDE.md, and the explainers. Possibly the Wasp angle (see Q3).

## What to keep, condense, or cut from GUIDE.md

| GUIDE section | For the post | Why |
|---|---|---|
| Checklist + levels | Keep, simplified to six steps | The levels are confusing: Level 2 "anyone can connect from a chat app" includes the CLI (step 8), which doesn't help chat apps |
| Mental model | Keep as is | The core idea |
| Which surfaces (Rhys notes) | Rewrite completely, with credit | Currently pasted notes, and partly contradicts our position (Rhys: "CLIs are just for humans long-term") |
| Steps 1–3 | Merge into one section | Three steps about one layer; the blog reader needs the idea, not three "Done when" blocks |
| Steps 4–6 | Keep, trim | Core of the post |
| Step 5 code mode / Cloudflare paragraph | Cut to one sentence or a footnote | A tangent for a reader building their first MCP server |
| Step 5 toolsets | Cut or one line | Optional, and few clients use it |
| Step 7 elicitation JSON and the 4-step retry flow | Cut, link to GUIDE | Too deep; most readers' clients don't support it yet |
| Step 6 OAuth security details (PKCE, refresh rotation, SSRF guards) | One sentence + link | Important, but it's a checklist for implementers, not blog prose |
| Step 8 CLI | Keep, shorten | Moves to last of the build steps |
| Step 9 discovery | Cut to a "bonus" paragraph or drop | Not built in Linkly, `llms.txt` is a convention, `/.well-known/openapi` is a proposal |
| Step 10 parity tests | One paragraph | Valuable but not exciting |
| Small things + mistakes | Merge into one list | Very shareable |
| The case for MCP | Pick the best 4–5 points | Currently ~40 bullets; the full list can stay in GUIDE.md |
| Claims that don't hold up | Keep, maybe as a callout | Good contrarian hook |
| Status box | Keep, dated | Readers need to know what's moving |

## What's missing from the guide

Things a reader will want that the guide doesn't cover yet:

1. **A retrofit path for existing apps.** The guide reads as greenfield. Most readers have logic inside controllers or React Query hooks. How do you extract operations incrementally? Start with the 3–5 actions agents will use most?
2. **Effort and cost.** How long did each step take in Linkly? The git history has the milestones (M0–M12); lines of code per surface would make "the adapters are short" concrete. The obvious headline: OAuth is the expensive part.
3. **How to test with real clients.** The dev loop: MCP Inspector, Claude Code against localhost, a tunnel for claude.ai and ChatGPT. Which clients are fussy about what.
4. **Checking your descriptions with a real model.** Evals: does the agent pick the right tool for 10 typical prompts? The guide lints descriptions but never tests them on a model.
5. **Prompt injection through your data.** Tool results contain user content (link titles, notes). An agent can read instructions planted there. The guide covers token theft but not this. Worth a short section: keep destructive actions behind the human, keep results structured.
6. **Rate limits, retries, and idempotency.** Agents retry aggressively and loop. Idempotency keys on creates, sensible `429`s with a retry hint.
7. **Result size.** Agents pay for every byte of a result. Default page sizes, summary vs. detail fields, truncation. Touched on (pagination), not developed.
8. **Observability.** Log tool calls per connection so you can see what agents actually do, which tools fail, and which descriptions confuse them.
9. **Concrete tool names.** The guide avoids naming libraries. A blog post can name a few: OpenAPI generators from code (e.g. zod-openapi, oRPC/tRPC adapters), spec-first generators (Speakeasy, Stainless), auth providers with MCP support. Needs a check for what's current.
10. **Versioning tools.** What happens when you rename a tool or change its schema? REST has `/v1`; MCP has nothing equivalent.
11. **Screenshots.** Consent screen, Connected apps, Claude Code's elicitation prompt, a chat transcript of the hook scenario.

## Open TODOs in GUIDE.md, and suggested answers

- **Line 16, move the CLI later?** Yes. Make it the last build step, after confirmations. It only reaches people with shells, and the other steps don't depend on it. Discovery and parity tests can follow as "polish."
- **Line 46, the Rhys section.** Rewrite in our voice, credit and link the post, quote one or two lines directly. Draft for section 3 above.
- **Line 74, the surface bullets.** "If all your users are developers, REST plus a CLI is enough, and you can skip MCP" is fine, but it sits awkwardly with the post's thesis that MCP is step 2. Reword to: "If all your users are developers, MCP is optional; it's still the cheapest way to get safety hints and one-click auth."
- **Line 315, do desktop apps have shells?** Partly. Claude Desktop's Code tab is Claude Code, so it has the user's real shell. Chat apps (claude.ai, ChatGPT) run code in a remote sandbox: it can't see the user's machine or config, it may not have network access, and installing your CLI and getting a token into it is on the user. So "if your users have shells" holds, if we say "a shell on their own machine." **Verify the current sandbox network rules before publishing.**

## Assets

- Existing: "Linkly's Four Ways In" animation, the OAuth flow explainer (`docs/oauth-flow-explainer.html`), `docs/imgs/`.
- Needed: consent screen screenshot, Connected apps screenshot, Claude Code elicitation screenshot, a chat transcript for the hook, a decision table graphic.

## Decisions

- **Audience:** web developers with a product *and* technical founders deciding what to build. So each step needs both the "why and in what order" (for founders) and a snippet or "done when" (for developers). The decision table in section 3 and the short answer in section 1 carry the founders; the steps carry the developers.
- **Format:** one long, definitive guide (~3,500 words), with GUIDE.md and the repo as the deep-dive appendix.
- **Wasp:** a light mention. Linkly is built with Wasp; one short note at the end on where Wasp is heading.
- **CLI:** optional and last. Nearly free from OpenAPI, so do it if it's cheap, but don't start there.
- **Gaps to cover in the post:** retrofitting an existing app (in section 4), testing with real clients and a model (9a), and agent-specific risks (9b). Effort numbers appear in the hook or the OAuth section. The other gaps (observability, tool versioning, named libraries, screenshots) go back into GUIDE.md or the asset list.

## Open questions

- **Q5. Where it's published,** and does it need a TL;DR thread or video version?
- **Q7. The hook:** A, B, C, or a mix (section 0). And which of Rhys's points to use.
