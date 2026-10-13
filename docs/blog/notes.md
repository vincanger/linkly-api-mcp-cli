# Notes for draft.md

Written sections: only a link back to the draft and the checks still open. The draft is the source of
truth for them. Unwritten sections: GOAL, WORDS, COVER, SOURCES, MATERIAL, DONE WHEN, TRANSITION.

THESIS: build an MCP server and a REST API together, on one layer of operations. MCP gets most of the
  design work (the client asks the human, stays within the grant, and keeps the token from the model).
  The API covers volume: raw data, bulk jobs, and software that isn't an agent. A CLI is optional.
  Supersedes the "MCP first, REST and CLI later" thesis in ../BLOG-POST-NOTES.md.
THE LINE FOR THE SKEPTIC: an API alone covers what agents *can* do; MCP covers what they *should* do.
  Building both costs little more than either one alone, once the operations exist.
BUDGET: ~5,400 as planned (the draft's header comment says ~5,000). The written sections run long: the
  short answer is ~560 (planned ~300), Why MCP ~620 (~500), Step 2 ~1,000 (~900), Step 3 ~740 (~500), Step 4 ~700 (~450), Step 5 ~440 (~250), Step 6 ~570 (~150). Risks ~275 (~350), Small things ~250 (~300), Where this is going ~400 (~250).
  Step 7 (~400 planned) was dropped. All sections are written: ~1,250 over, so ~6,650 unless you trim. If you need to cut, merge "Risks"
  and "Small things" into one list (~250).

## Agents are your new users

[Back to draft](./draft.md#agents-are-your-new-users)

WRITTEN. Open checks:
  - [ ] Typo: "determinstic" → "deterministic".

## The short answer

[Back to draft](./draft.md#the-short-answer)

WRITTEN. Open checks:
  - [ ] Typos: "it's inputs" → "its inputs"; "determistic" → "deterministic"; "Let the API handle
    volume" needs a period after it, like the other two bolded claims.
  - [ ] The TODO for the Linkly repo link (the intro's NOTE already links it).
  - [ ] Someone could screenshot this section and have the whole argument.
  - [ ] The SVG is small on phones (a stacked version is possible), and it ignores reduced motion.
REFERENCE: [assets/send-confirmation.svg](./assets/send-confirmation.svg) is generated. Edit
  [assets/send-confirmation.py](./assets/send-confirmation.py) (captions, timings, labels), then run
  `python3 assets/send-confirmation.py assets/send-confirmation.svg` from docs/blog.

## Why MCP gets most of your attention

[Back to draft](./draft.md#why-mcp-gets-most-of-your-attention)

WRITTEN. Open checks:
  - [ ] Login: the plan had a paragraph on it (paste one URL, the client runs OAuth, the model never sees
    a token), but the section has none. Login only comes up in the short answer's second claim. Add it,
    or decide that's enough.
  - [ ] Recheck right before publishing: the Events date (ChatGPT, 2026-09-29; the source is
    https://mixed-news.com/en/chatgpt-mcp-events-webhooks-draft-spec-work-chats/) and which clients
    support elicitation.
  - [ ] What happens after a Cancel in the 2026-07-28 flow (the agent "learns you cancelled") is unverified.
  - [ ] The MCP Apps GIF is 4.1 MB; convert it to MP4 (there's a TODO in the draft).
  - [ ] Check Rhys's quotes against the originals before using them.
REFERENCE, Rhys's two quotes (the second is the thesis in his words; Step 3 can tie back to it):

> "you can trivially convert from an MCP to a CLI, you cannot convert from a CLI to an MCP in that same way. CLIs also don't have the same annotations the MCP or OpenAPI specs do around what actions are destructive, although LLMs are getting good enough that this doesn't matter as much."
>
> [Rhys Sullivan](https://x.com/RhysSullivan/status/2070311929038680262)

> "the world i'd like to end up in is one where all companies support CIMD OAuth to their MCP server and their OpenAPI spec. the OpenAPI spec is able to be used for raw data access, bulk processing, and the MCP is able to provide a more curated experience..."
>
> [Rhys Sullivan](https://x.com/RhysSullivan/status/2070311929038680262)

## Step 1: Put your logic in operations

[Back to draft](./draft.md#step-1-put-your-logic-in-operations)

WRITTEN. The five-field table moved to Step 2, and permissions (the Principal and SCOPES code) to Step 3,
to match where Linkly writes them. Open checks:
  - [ ] GitHub links use line numbers from local main, which is ahead of origin. Push before publishing,
    and recheck service.ts#L80-L111.
  - [ ] The createLink snippet is simplified (no tags/title cleanup, no unique-violation catch). Is
    "simplified" enough of a label?
  - [ ] A reader could write their first operation from this section.

## Step 2: Expose them through MCP and REST at the same time

[Back to draft](./draft.md#step-2-expose-them-through-mcp-and-rest-at-the-same-time)

WRITTEN (~1,000 words; planned ~900). Open checks:
  - [ ] TODO in the draft: turn the raw/bulk/curated table into an animated SVG, like the other two.
  - [ ] Counts are from the code on 2026-10-12: 11 MCP tools, 10 REST operations, 100 links per page. Recheck
    if tools or endpoints change.
  - [ ] The curated row is honest now: REST also answers in one call (GET /api/v1/links/{id}/stats also
    returns a dashboardUrl). MCP's edge there is reach (no shell or token) and the description's guidance.
    Make sure that still reads as a reason for MCP.
  - [ ] The table was reframed 2026-10-12: code mode makes MCP match a script for one-off raw/bulk jobs, so
    the API's rows are now "no agent involved" and "a job you'll rerun", not volume. The short answer's
    "Let the API handle volume" and the intro's "the API handles bulk data" still lean on volume. Reword?
  - [ ] Your lead-in ("most agents would be better off leveraging deterministic tools... rather than
    through MCP tools") is stronger than the new paragraph after the table. Check they agree.
  - [ ] Not used: Rhys's "api" escape-hatch tool (optional in the plan).
  - [ ] Recheck the Cloudflare figures before publishing: 2,500+ endpoints behind two tools, search() and
    execute() (blog.cloudflare.com/code-mode-mcp, Feb 2026). The "one tool per endpoint" argument is now about
    descriptions, not tool count or context (2026-10-12).
  - [ ] The code block is the real create_link from src/links/mcp.ts. Keep it in sync if the tool changes.

## Step 3: One OAuth server in front of MCP and REST

[Back to draft](./draft.md#step-3-one-oauth-server-in-front-of-mcp-and-rest)

WRITTEN (~740 words; planned ~500). Open checks:
  - [ ] TODO in the draft: replace the consent-screen mockup with a screenshot (assets/consent-screen.png).
    Maybe the Connected apps page too.
  - [ ] TODO in the draft: name a few auth providers that support MCP authorization with CIMD.
  - [x] Spec wording checked (2026-10-13): 2025-11-25 and 2026-07-28 both say servers and clients "SHOULD
    support" CIMD; 2026-07-28 adds that DCR "is deprecated". Claude Code's client ID URL serves its document.
  - [ ] Check Rhys's quote against the original before publishing.
  - [ ] "I haven't seen an agent client do the same for an arbitrary REST API yet": recheck before publishing.
  - [ ] Long: if you need to cut, the four permission bullets could drop to two (write includes read; the
    grant is re-read on every request).
  - [ ] Cut from the draft: the Principal type and the SCOPES code (now one sentence and a link each).
  - [ ] Covers the short answer's "it handles the login, keeps the token away from the model" claim, which
    Why MCP doesn't. Decide whether Why MCP still needs its login paragraph (open check there).
Verified in the code 2026-10-12: access tokens 1h, refresh 30 days with rotation and reuse revocation
  (oauth/token.ts); audience error text (shared/bearer.ts); /api/v1 accepted as an OAuth resource
  (oauth/authorize.ts); PATs work on both surfaces and take scopes (tokens/); consent wording
  (oauth/ui/ConsentPage.tsx); scopes capped at what the app requested (shared/scopes.ts capScopes).

## Step 4: Make destructive actions wait for the human

[Back to draft](./draft.md#step-4-make-destructive-actions-wait-for-the-human)

WRITTEN (~700 words; planned ~450). Open checks:
  - [ ] TODO in the draft: elicitation.mp4 is 38 MB and won't play inside ![](). Use a <video> tag with a
    poster frame, or compress it.
  - [ ] Recheck client support before publishing: Claude Code CLI opens the page; Codex and OpenCode with
    opt-in settings; ChatGPT, Claude Desktop, claude.ai don't (from GUIDE.md, October 2026).
  - [ ] "Claude Code was in auto mode the whole time": true in the video (the status bar says auto mode on).
    Keep only if you're happy naming the mode.
  - [ ] Long: if you need to cut, shrink the stateless-mechanics part (two bullets) to one sentence and the
    guide link.
  - [ ] Not used: the input_required JSON from GUIDE.md (linked instead).
Verified in the code 2026-10-12: 15-minute expiry (deeplinks/pendingActions.ts), single use and owner-only
  ("This confirmation link isn't valid for your account"), 20-second wait with up to 8 quiet retries
  (mcp/confirmations.ts), decline withdraws the pending deletion, toggle on by default (ConsentPage.tsx),
  sessions and PATs delete immediately (links/service.ts requestDeletion), REST 202 (links/rest.ts),
  delete_link's archive hint (links/mcp.ts). Video content checked frame by frame.

## Step 5: A CLI, if your users have shells

[Back to draft](./draft.md#step-5-a-cli-if-your-users-have-shells)

WRITTEN (~440 words with code; planned ~250). Open checks:
  - [ ] Verify before publishing: chat apps' sandboxes can't see the user's machine, and Claude Desktop's
    Code tab has a real shell.
  - [ ] Linkly's CLI logs in with a personal access token, not OAuth. The section says so and presents
    browser login as an option. Build it, or leave it as is.
  - [ ] Optional: a stdin mode (`linkly links create -`, one URL per line) would replace the xargs example.
  - [ ] "Keep no hidden state" (GUIDE's sixth rule) is only implied by "a config file only you can read".
  - [ ] Not used: Rhys's "MCP converts down to a CLI, not back up" quote; GUIDE's code-mode paragraph (Step 2
    already covers code mode).
  - [ ] Long: if you need to cut, drop the debugging paragraph and the --help bullet (~45 words).
Verified in the code 2026-10-12: exit codes (cli/src/errors.ts), JSON when stdout isn't a TTY and errors on
  stderr (cli/src/output.ts), the --yes refusal message and exit 2 (cli/src/program.ts links delete), PAT
  login, LINKLY_TOKEN and the 0600 config file (cli/src/config.ts), types generated from the OpenAPI snapshot
  (cli/package.json gen), `links list --all`.

## Step 6: Help agents find you from your domain

[Back to draft](./draft.md#step-6-help-agents-find-you-from-your-domain)

WRITTEN (~570 words, ~190 of them the llms.txt excerpt; planned ~150). Open checks:
  - [ ] The M10 code is uncommitted. Commit and push before publishing, then recheck the line numbers in
    HomePage.tsx#L45-L63, http.ts#L38-L42, ConnectionsPage.tsx#L75-L94.
  - [ ] Recheck before publishing: RFC 9727's api-catalog is still the only registered well-known path for
    API discovery, and there's still no standard path for an OpenAPI document (NOTES.md, M10).
  - [ ] "Agents usually fetch your page and read it as text": a general claim, not checked per client.
  - [ ] The llms.txt excerpt uses myapp.com for both the dashboard and the API server. In Linkly they're two
    sites (Wasp serves them separately). Fine for the post, but don't copy it as the literal file.
  - [ ] Long: if you need to cut, trim the llms.txt excerpt to the MCP and Rules sections (~80 words), or
    drop it and link to llmsTxt.ts.
  - [ ] Not used: the `<link rel="alternate" type="text/markdown">` head tag (main.wasp.ts), the Vite plugin
    (vite.config.ts), and the build check (tests/build/discovery.check.ts, e2e/discovery.spec.ts). The drift-tests
    bullet in "Small things" could mention the last two.
Verified in the code 2026-10-13: llms.txt content and order (src/discovery/llmsTxt.ts), build-time
  generation (vite.config.ts llmsTxt plugin), prerender on / and /docs (app.wasp.ts, docs.wasp.ts), "For AI
  agents" card with MCP URL and llms.txt link (HomePage.tsx), /.well-known/openapi.json is the same handler
  (openapi/handler.ts), /.well-known/api-catalog (discovery/apiCatalog.ts), service-desc Link header on
  /api/v1 (shared/http.ts), "Connect an AI agent" card and prompt text (oauth/ui/ConnectionsPage.tsx).

## Risks that come with agent callers

[Back to draft](./draft.md#risks-that-come-with-agent-callers)

WRITTEN (~275 words; planned ~350). Open checks:
  - [ ] Linkly has no rate limiting (SPEC.md keeps it out of scope). The section says so. Build it, or
    leave it as a recommendation.
  - [ ] Cut on purpose: idempotency keys, result size, and the slug-conflict-on-retry detail.
Verified in the code 2026-10-13: only the referrer's hostname is stored (analytics/clicks.ts referrerHost);
  the user agent is stored but no tool, endpoint, or page returns it; referrers come back through
  get_link_stats with groupBy referrer (analytics/mcp.ts).

## Small things agents notice

[Back to draft](./draft.md#small-things-agents-notice)

WRITTEN (~260 words; planned ~300). Renamed from "Small things agents notice, and mistakes to avoid":
  every item on GUIDE's "Mistakes to avoid" list is already covered by a step, so the list was cut. Open checks:
  - [ ] Client support for URL elicitation ("only some of them open Step 4's confirmation page"): recheck
    before publishing.
  - [ ] parity.test.ts#L10-L35 and destructiveFlags.test.ts links: recheck after pushing.
  - [ ] Cut for length: the MCP Inspector (and its DCR catch), the `claude mcp add` command, the CLI's
    OpenAPI drift test, evals, descriptions.test.ts, e2e/oauth.spec.ts.
  - [ ] Cut as repeats of earlier steps: error mapping per surface (Step 1), cursor pagination and
    structured results (Step 2), and every "Mistakes to avoid" item (Steps 1–6).
Verified in the code 2026-10-13: get_link takes an ID or a slug (links/mcp.ts); the not-found message
  (links/service.ts); whoami returns username, scopes, toolsets, and the confirmation setting (account/mcp.ts).

## Where this is going

[Back to draft](./draft.md#where-this-is-going)

WRITTEN (~400 words; planned ~250). Open checks:
  - [ ] TODO in the draft: the client-support table was cut (every cell was "?"). Bring it back only if
    every cell can be filled and dated.
  - [ ] TODO in the draft: the Wasp sentence is vague on purpose ("the kind of thing we'd like Wasp to
    handle"). Say what's actually planned, from ../AGENT-READY-APPS.md#in-wasp, or keep it.
  - [ ] Recheck right before publishing (from GUIDE.md's "Status, as of October 2026" and NOTES.md):
    URL elicitation support per client, Events in ChatGPT with the spec still a draft, CIMD still an IETF
    draft, code mode not offered for MCP tools in most chat apps.
  - [ ] "The design is ready for agent clients running OAuth for any API": Linkly accepts /api/v1 as an
    OAuth resource (Step 3), so it holds as long as clients follow the same 401 + metadata flow.
  - [ ] Long: if you need to cut, drop the code mode bullet (Why MCP and Step 2 already cover it) and the
    OAuth explainer link (~50 words).
