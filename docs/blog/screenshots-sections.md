# Where the screenshots could go in the Notion draft

Notes on placing the new screenshots in the [Notion version of the draft](https://app.notion.com/p/wasp-lang/How-to-make-your-app-usable-by-AI-agents-MCPs-APIS-CLIs-3f918a74854c800c9c51e0abf8bf5e4d). All of them are in `docs/blog/assets/`. They were taken on 2026-10-14 from the deployed app (linkly-mcp-client.fly.dev), logged in as `vinny`, at 1440px wide and 2x scale.

Heads-up: most of these were taken before the latest redeploy, while Fly was still on the Oct 1 build. The landing page has since been retaken with the "For AI agents" card, and so has `screenshot-connections.png`, which now shows the "Connect an AI agent" card above the connected apps table.

The clicks on `/r/wasp` (47, from x.com, news.ycombinator.com, github.com, google.com, and direct) are test clicks I sent so the charts have something in them. They all landed on Oct 14, so the "by day" chart is a flat line with one spike.

## The best fits

### `screenshot-consent.png` → "One OAuth server in front of both" (done: added to Notion and draft-2.md)

This one replaces the existing TODO callout ("replace this mockup with a screenshot of the consent screen") and the ASCII mockup code block under it, right after "...they log in if they aren't already, and they see this:". It's the real consent page for Claude Code, with the same text as the mockup: App address claude.ai, the unverified-app warning, the three permission checkboxes, the "Require confirmation for destructive actions" toggle, and Deny/Allow.

It also backs up the later paragraph that starts "Let's take a step back and look at the permissions on the consent screen", so you could leave that paragraph as is.

### `screenshot-connections.png` → "Destructive actions wait for the human, on every surface" (done: added to Notion and draft-2.md)

In the "Two last things" list, the **Let each connection choose** bullet says users can change the confirmation toggle "later on the Connected apps page". This screenshot shows exactly that page: Claude Code connected, its permissions, and the Confirm deletions toggle. It could go right after that bullet.

It could also work in the OAuth section, after the point that the client keeps the token and the model never sees it, to show what the user can still see and revoke on their side. I'd pick one spot, not both.

(After a redeploy this page also has the "Connect an AI agent" card, which the last paragraph of "Help agents find you from your domain" links to. A retake that includes the card could go there instead.)

### `screenshot-link-stats-by-referrer.png` → "What MCP gives you that an API can't" (done: added to Notion and draft-2.md)

In the fallbacks list near the end of that section, the first bullet says "Linkly can't draw a chart in every chat, so every stats result includes a `dashboardUrl` that opens the same chart in the app." This is that chart, so it shows readers what the agent is actually handing them.

The same idea shows up in the table in "Where an API (and a CLI) still win" ("Its description tells the model to share the `dashboardUrl`, which opens an interactive chart in Linkly"), so if you'd rather keep Part 1's first section lighter, it could go after the table instead.

`screenshot-link-stats-by-day.png` is the same page grouped by day. With all the clicks on one day it doesn't look great, so I'd use the referrer one.

### `screenshot-landing.png` → "Help agents find you from your domain" (done: added to Notion and draft-2.md)

The second bullet ("A prerendered landing page with a visible 'For AI agents' section") is the obvious spot. The screenshot shows the hero and the "For AI agents" card with the MCP server URL and the llms.txt URL, so it fits right after that bullet. It's also the README header now.

## Optional

### `screenshot-links.png` → "Agents are your new users"

The intro says "Linkly has a dashboard, an MCP server, a REST API, and a CLI". A quick look at the dashboard after that paragraph helps people picture the example app before Part 1 starts. It's the links list with `/r/wasp`, `/r/railway`, and `/r/x-com`, which I created through the MCP server.

### `screenshot-link-edit.png` → "The foundation: operations underneath every surface"

The section says "when you click 'Create link' in Linkly's dashboard, it calls the exact same `createLink` function that an agent calls through MCP". This is the edit form rather than the create form, but it's the same fields (destination, slug, title, tags), so it could sit next to that sentence or next to the two-layers diagram. Probably not worth it if the diagram is already there.

### `screenshot-tokens.png` → "One OAuth server in front of both" or "The REST API"

TL;DR step 4 says "Keep personal access tokens for scripts", and the OAuth section mentions personal access tokens as the other way to log in. The Tokens page shows that a token gets the same permission checkboxes as the consent screen, which is a nice detail if you want to make the point that both paths use one list of permissions (the paragraph that links to `src/shared/scopes.ts`).

### `screenshot-top-links.png` and `screenshot-docs.png`

I don't think either needs to be in the post. The docs page could go in the MCP checklist next to **Add tools for your docs** (`search_docs`/`read_doc`), to show that the agent searches the same docs a person reads in the dashboard, but it's a pretty plain list of cards.
