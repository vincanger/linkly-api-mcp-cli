# Working title: How to make your app usable by AI agents (MCPs, APIS, CLIs)


## Agents are your new users

We're at the end of 2026, and for the first time, [more than half of internet traffic isn't human](https://blog.cloudflare.com/agentic-web/), while daily requests from AI agents grew by more than 1,700% in the past year. 

These are crazy statistics. 

But if you're someone who works close to this tech you don't even have to see the numbers, you just sense it. As a web developer, I, for one, feel increasingly left behind when considering how to build apps for agents. 

For example, when MCP servers dropped last year a lot of the [loudest voices derided them](https://x.com/levelsio/status/2031943074151104634?s=20), claiming there was nothing they can do that APIs or CLIs can't do better.

But when you consider that agents and bots are now outnumbering humans on the web, it makes sense to use and build tools that help them get the most value out of your apps as possible. So, I set out to figure out what those tools might be, and I outline what I landed on in this article below.

To get there, I did a lot of reading and exploring, and built an open-sourced link shortener, called Linkly, as an example app, that has a dashboard, an MCP server, a REST API, and a CLI. All the examples in this post come from it, and the repo is [here](https://github.com/vincanger/linkly-api-mcp-cli).

<!-- TODO (agent): should I leave this section here or delete it entirely? -->
Before we begin, let me quickly tell you where I stand on this topic: In my opinion, I think your web app should:
- expose a high-quality MCP server and a REST API together, on top of the same logic.
- in most cases, you'll want to focus more on the MCP server, because that's where agents get the best experience (MCP is a standard purpose built for agents, after all). 
- APIs still work great for most agents, and are great as fallbacks or for apps that expose a lot of raw data. 
- You're less likely to need to expose a CLI, but it's easy to do so if you've got a good API as the foundation.

The rest of this post explains why and walks through the best practices for building each surface: e.g. how to structure your app for that, how to authenticate should work best for it, how to stop agents from doing things the user didn't mean, and how to make your app friendly for all types of agents.

## The short answer

Ok. Here's the TL;DR for the lazy people:

**Build a high-quality MCP server and REST API at the same time, on one layer of operations.** Put your logic in plain functions, and each surface becomes a thin adapter over them. Once that layer exists, building two surfaces is pretty easy.

**Put most of your care into the MCP server.** An API can only describe your server, and it's inputs and outputs. MCP is a standard built *specifically* for agents, so it also defines what the client does: it handles the login, keeps sensitive information away from the model, asks you before anything irreversible happens, and can show interactive UI right in the chat. And that list keeps growing. With an API, all of that is left up to the agent.

**Let the API handle volume** APIs are great for dealing with raw data and bulk jobs. Having an API as a fallback or so an agent can build determistic tools to work with it makes a lot of sense in some cases.

**A CLI probably isn't necessary** but it's easy to expose one if you've got a good API as the foundation.

As a quick explainer for my reasoning above, let's take an example of sending emails in bulk via an agent, animated below. You ask an agent to email everyone on your mailing list about the community call. It takes the date from an old doc, Nov 12, but you've since moved the call to Nov 19. Your app wants a confirmation before it emails thousands of people:

![Two panels. With only an API, your API asks for confirmation, the question goes back to the agent, and the agent answers confirm=true itself, so 2,043 people get the old date without anyone asking you. With MCP, the server's question goes to the client app, which shows you the email: "Email 2,043 people? Community call, Thu, Nov 12, 5pm." You spot the old date and click Cancel, nothing is sent, and the agent learns you cancelled.](./assets/send-confirmation.svg)

With the API, the server's question goes to the agent, so the agent can answer it for you, and 2,043 people get the wrong date. With MCP, the question goes straight to the client, which shows you the email before it goes out. You spot the old date and cancel, and the agent never even gets the chance to answer in your place.

It's a simple example, but I think it illustrates how MCP offers a standardized, curated experince for an agent to connect to tools (more on that in the next section below).

To build this all into your app, I suggest you use the following structure:

1. [Put your logic in operations](#step-1-put-your-logic-in-operations), one function per action, so every surface is a thin adapter over the same code.
2. [Expose them through MCP and REST at the same time](#step-2-expose-them-through-mcp-and-rest-at-the-same-time): task-shaped tools with descriptions written for the model on the MCP side, and resources and an OpenAPI document for the API.
3. [Put one OAuth server in front of both](#step-3-one-oauth-server-in-front-of-mcp-and-rest), and let people choose each permission. Keep personal access tokens for scripts.
4. [Make destructive actions wait for the human](#step-4-make-destructive-actions-wait-for-the-human): make sure that either the MCP client or your dashboard holds the final confirmation step, not the agent.
5. [Add a CLI](#step-5-a-cli-if-your-users-have-shells), if your users really need it.
6. [Help agents find you](#step-6-help-agents-find-you-from-your-domain) from your domain alone.

Steps 1–4 are the minimum for allowing basically every agent to connect (from the ChatGPT desktop app, to simple chat app-based assitants), and so can every script.

But before we go into more detail on how to build each surface, let's talk a bit more about how I came up with this opinion, and why I think you should adopt it.

## Why MCP gets most of your attention

MCP is the standard way for agents to connect to apps, tools, and data. It was designed for exactly this, and it's maturing fast: the [2026-07-28 revision](https://modelcontextprotocol.io/specification/2026-07-28) made the protocol stateless, and clients are tackling its context bloat with tool search and [code mode](https://www.anthropic.com/engineering/code-execution-with-mcp) (which were the first real gripes developers had with it -- and rightly so.), so connecting lots of servers to one agent is no longer the problem it was just a handful of months ago.

But, even more broadly, MCP just gives you and your agent a nicer, more curated experience because it standardizes how things should be done on the server and client side. An API (and its OpenAPI document) only describes your server: its endpoints, and their inputs and outputs. Nothing in it says what the client should do. MCP defines the client's behavior, too (e.g. the desktop app, IDE, or assistant on your phone that sits between the agent and the human user). That's what lets an MCP do things an API can't.

Take the email from the animation above. A send genreally can't be undone, and the agent can get things wrong/ahead of itself, so you want the human to check it first. With an API, you have to *bend* the API to make that happen. A `confirm=true` flag doesn't help, because the agent sets it itself. So the send has to return a `202 Accepted` with a confirmation link instead, and behind it you build pending sends, a confirmation page, and probably an endpoint to check whether the user confirmed (and even then a proactive agent could still use computer use to send it through -- [yes, this kind of stuff does still happen](https://x.com/ShaneMac/status/2107486740491669879?s=20)).

With MCP, the server answers the `send_campaign` call with an [elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation): a question for the user that shows what's about to go out, "Email 2,043 people? Community call, Thu, Nov 12, 5pm", with Send and Cancel buttons. The client, not the agent, shows it to the user. If they click Send, the client retries the call with their answer, and the server sends the email. If they spot the old date and click Cancel, nothing goes out, and the agent learns they cancelled, so it can fix the date and try again. And because your server writes the question, it can show exactly what the user needs to check ([Step 4](#step-4-make-destructive-actions-wait-for-the-human) builds that version for deleting a link in Linkly, video included).

And the list of things only MCP can do keeps growing. For example, MCP Apps put UI, like an interactive chart or a form, right in the chat. Here's the Excalidraw MCP App drawing a diagram inside a Claude chat:

<!-- TODO: convert to mp4 -->
![The Excalidraw MCP App in a Claude chat: the user asks for a diagram, and an editable Excalidraw drawing appears inline in the conversation, with Claude's reply underneath.](./assets/mcp-app-excalidraw.gif)

[MCP Events](https://mixed-news.com/en/chatgpt-mcp-events-webhooks-draft-spec-work-chats/), which ChatGPT shipped on September 29, let your server tell the agent when something changes, so it can act on it automatically without anyone typing a prompt. Client support is still uneven, so each feature needs a fallback for the clients that lag behind, but the space is progressing quickly and the future is looking bright.

None of this means APIs are bad for agents. They're [probably fine for 90% of applications](https://x.com/RhysSullivan/status/2070630745891365008): agents call them easily, they're the right tool for raw data, and with a well-written OpenAPI doc, an agent can even turn one into an MCP server for you. CLIs work well too, for agents that have a shell.

So, to put it simply: an API alone covers what agents *can* do, and MCP covers what they *should* do. And if both sit on the same foundation, building them costs little more than building one, which brings us to the first step.

## Step 1: Put your logic in operations

If you split your app into two layers, every surface you build on top gets the same logic underneath. Your dashboard, the API, your MCP server, and a CLI all call the same operations, so there's no duplicated logic to drift apart between them.

Here are the two layers:

1. **Operations:** your business logic, one function per thing a user can do.
2. **Surfaces:** thin adapters that expose those operations to each kind of caller.

So, when you click "Create link" in Linkly's dashboard, it calls the exact same [`createLink` function](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/links/service.ts#L80-L111) that an agent calls through MCP, or a script calls through the REST API.

![Four callers (dashboard, MCP server, REST API, CLI) each pass through a one-line adapter, or the REST API for the CLI, and land on the same createLink operation, which sends the same result back to all four.](./assets/two-layers.svg)

Even the CLI doesn't have any server code of its own. It's just a client for the REST API.

Why does that matter? Because everything that actually makes your app *your app* lives in the operation: who's allowed to do what, what counts as valid input, the business rules, and the error messages. Here's `createLink`, simplified:

```ts
export async function createLink(p: Principal, input: LinkInput, { prisma }: Deps): Promise<LinkOut> {
  requireScope(p, "links:write");            // who's allowed
  const data = parseInput(LinkInput, input); // what counts as valid input
  if (data.slug) {
    await assertSlugFree(prisma, data.slug); // the rules: a taken slug throws a "conflict" error
    return toLinkOut(await prisma.link.create({ data: { ...data, userId: p.userId } }));
  }
  // ...otherwise, retry random slugs until one is free
}
```

Every operation in Linkly has this same shape: who's calling (a `Principal`, more on it in Step 3), the input, and its dependencies, like the database. There's no `req`, `res`, or MCP anywhere in it, so any surface can call it, and you can test it without starting a server.

Each surface just translates. It turns its own kind of login into a `Principal`, passes the input along, and formats the result for whoever asked. In Linkly, that translation is literally one line per surface:

```ts
// Dashboard (an operation)
runOperation(() => links.createLink(sessionPrincipal(context), args, deps))

// REST API: POST /api/v1/links
res.status(201).json(await links.createLink(p, req.body ?? {}, deps))

// MCP server: the create_link tool
handler: (p, input) => links.createLink(p, input, deps)
```

The MCP tool has more around that line: a name, a description written for the model, and hints about whether it changes anything. That's about describing the tool, not about logic, so it's in Step 2.

With two layers, the rules live in one place and even errors stay consistent: a taken slug is one error in the operation, and [each surface just shows it its own way](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/shared/errors.ts), e.g. a toast in the dashboard, a `409` from the API, a tool error the agent can read and retry, and an exit code in the CLI.

And this is what makes adding surfaces cheap. Once your operations exist, the MCP server, the REST API, and the CLI are all small additions instead of rewrites, which can be trivial for a coding agent.

If you already have an app, your logic probably lives in controllers or UI code, and you don't have to move all of it at once. Pick the 3–5 actions an agent would use most. For Linkly, that's creating a link, listing links, and getting a link's stats. Move each one into an operation, then point your dashboard at it first, so your own users test it before any agent does. Once it works there, exposing it to agents is just adding adapters, which is the next step.

## Step 2: Expose them through MCP and REST at the same time

[Notes](./notes.md#step-2-expose-them-through-mcp-and-rest-at-the-same-time)

Once your operations exist, the MCP server and the REST API are just two thin layers over the same functions, so you can pretty much build them in whichever order you prefer. They're two different shapes for two different kinds of callers, and getting those shapes right is most of the work in this step.

A REST API is shaped around resources: e.g. links and stats, each with its endpoints, filters, and pagination. It's generally written for a developer and their agent that reads the docs and then writes code against them. An MCP server is shaped around tasks, and it's written for a model that searches for the right tool and reads its description each time it decides what to call.

In a small app like Linkly, the two line up almost one-to-one: 11 tools and 10 REST operations. That's fine. A huge tool list isn't a problem anymore either: with tool search and code mode, the model only loads what it needs. 

And to make MCP tools more "attractive" to an agent is how they're described to the model. A model calling MCP tools reads a tool's description every time it decides what to call, so the description has to carry the "how it all fits together" part too: e.g. when to use this tool instead of a similar one, what to do after it, and what to show the user. If you just generate one tool per endpoint, you end up with the API reference, but none of the know-how about actually using it.

In Step 1, I said the MCP tool has a bit more around that one line that calls the operation. Check out the example for `create_link` to see what I mean:

```ts
// src/links/mcp.ts
defineTool({
  name: "create_link",
  title: "Create a link",
  toolset: "links",
  scope: "links:write",
  description:
    "Creates a short link that redirects to `destinationUrl`. Omit `slug` for a random 7-character one; a taken slug returns a conflict error. Returns the new link with its `shortUrl` to share. To change it later use update_link.",
  input: {
    destinationUrl: destinationUrlSchema,
    slug: slugSchema.optional().describe("Custom slug (3–40 chars of a-z, 0-9, '-'). Omit it for a random one."),
    title: titleSchema.optional().describe("Optional human-readable label for the link."),
    tags: tagsSchema.optional().describe("Up to 10 tags (each up to 30 chars) for grouping and filtering. Stored lowercase."),
  },
  output: LinkOut.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (p, input) => links.createLink(p, input, deps),
}),
```

The input schemas and the permission (`scope`) are the same ones every other surface uses. What's written just for MCP is the description and the annotations. It says what happens with a taken slug, what comes back, and which tool to use next. The annotations tell the client whether the tool only reads or changes something, and clients use them to decide what to check with the user (more on that in Step 4).

Here's the checklist I'd hold any MCP server to:

- **Descriptions say when to use the tool *instead of* a related one**, and what to do after common errors.
- **Cover every capability**, without near-duplicate tools the model has to choose between.
- **Don't merge across a permission or risk boundary.** Reading a link and deleting it stay separate tools.
- **List only what the connection is allowed to use.** Linkly hides the tools whose permission the user didn't grant, so the model never tries them.
- **Add annotations and output schemas to every tool, and instructions to the server.** The instructions are a few sentences the client can hand the model up front: what your app is, and how its tools fit together.
- **Link back to your app.** Many of Linkly's tool results include deeplinks to a `dashboardUrl`, so the user can open the same view in the dashboard.

The REST API has less to invent, but three things sstill matter most for agents and the code they write:

- **Generate the OpenAPI doc from the same schemas** the operations validate with, so the documented inputs can't drift from the real ones.
- **Mark risk with `x-destructive`.** The HTTP method doesn't tell an agent what's dangerous. Think about our email sending example where a `POST` can email 2,043 people. This is an action you'd potentially want human confirmation on.
- **Paginate with cursors**, because bulk work is where an API really shines.

So why build both, and not just MCP? Because some apps may be more geared towards raw data access, and most agents would be better off leveraging deterministic tools (e.g. scripts, small apps) that call the API directly rather than through MCP tools. 

For example, here are two tasks in Linkly, done both ways:

<!-- TODO: turn this table into an animated SVG, in the style of two-layers.svg and send-confirmation.svg. -->

| Task (Linkly) | OpenAPI + a script | MCP tools |
|---|---|---|
| **A job you'll rerun:** "Tag every link to example.com as `partner`, and do it again each month" | List, filter, then `PATCH` each match. A script anyone on the team can read, rerun, and schedule. | With code mode, one loop over `update_link`, but it lives in one conversation. Without it, 300 round trips through the model. |
| **Curated:** "How did my launch link do last week?" | One `GET /api/v1/links/{id}/stats` call. | One `get_link_stats` call from any client which returns an interactive chart view via MCP apps functionality. Its description tells the model to share the chart link, and to use `get_top_links` to compare links. |

Notice that the API's advantage isn't really volume. Without code mode, every row an MCP tool returns passes through the model's context, and every update enters the model's context. But clients with [code mode](#why-mcp-gets-most-of-your-attention) close that gap, allowing the model to write a loop over your tools (that's the "code), run it in the client's sandbox (and that's the "mode"), and only return result back. For an agent doing a job once, that's just as good as a script.

What code mode doesn't change though is who's calling. A nightly sync, an internal tool, or another company's integration will be better off using an API. And when a job is worth keeping, you probably want your agent to generate some code or a script around it, rather than repeatedly calling the endpoint from within an agent's chat thread.

Now for the curated task, MCP brings a lot of advantages. Both surfaces can answer "How did my launch link do last week?" in one call. But the MCP tool will work in any client where you've connected Linkly (you can't always connect to APIs in agent desktop apps, for example). And the tools allow the agent to provide a richer experience for the user, like showing interactive charts, or coming with instructions on using `get_top_links` in a follow up to compare links.

One more important thing to consider is providing fallbacks. Because the space is moving so fast, not all MCP clients implement every feature (e.g. MCP apps), meaning many of them need a fallback for clients that don't support it yet. The nice thing is that a link to the app is almost always a good fallback. Linkly can't draw a chart in every chat, so every stats result includes a deeplink (e.g. a `dashboardUrl`) that opens the same chart in the app. And instead of a form in the chat, `get_dashboard_url` can return a link to Linkly's create form, already filled in (see Step 4 for more examples of fallbacks).

Now that we've covered both surfaces, they need one way to log in, and OAuth solves that for us.

## Step 3: One OAuth server in front of MCP and REST

The MCP spec recommends a way of identifying clients called CIMD (Client ID Metadata Documents). It's been the recommended option since November 2025, and the [July 2026 revision](https://modelcontextprotocol.io/specification/2026-07-28) went further and deprecated the older alternative, Dynamic Client Registration. With CIMD, the client's ID is a URL, like `https://claude.ai/oauth/claude-code-client-metadata`, that points to a small JSON file with the client's name and redirect URIs. So any client can connect to your server without registering first: your server just fetches that file the first time it sees the URL.

Here's what connecting to Linkly, which uses CIMD OAuth on the server, looks like for an agent. The user pastes Linkly's MCP URL into their client (usually as a "connector" or via a CLI command), a browser window opens on Linkly, they log in if they aren't already, and they see this:

<!-- TODO: replace this mockup with a screenshot of the consent screen (src/oauth/ui/ConsentPage.tsx), e.g. ./assets/consent-screen.png -->

```
Allow Claude Code to access your Linkly account?
App address: claude.ai
Linkly hasn't verified this app. Only continue if you trust claude.ai.

What it can do
Links      [x] View your links
           [x] Create, edit, and delete your links
Analytics  [x] View click analytics
[on] Require confirmation for destructive actions
                                         [Deny]  [Allow]
```

Nobody has to create a token, copy it, and paste it somewhere. Nobody has to go to a dashboard and pre-register an OAuth app's client ID and secret either. Instead, they just paste an MPC url, then click Connect and Allow, and they're done. The client keeps the token and attaches it to every request on its own, so the model never even sees it. That's what I meant in [the short answer](#the-short-answer) when I said MCP clients handle the login.

Behind that screen is standard OAuth, and the client finds all of it from the URL alone. Its first request has no token, so Linkly answers with a pointer:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://myapp.com/.well-known/oauth-protected-resource/mcp"
```

That document names your authorization server, and the server's own metadata lists where to log in and where to get tokens. From there, the client can run the whole login by itself, because the JSON at that client's CIMD URL lists the app's name and where to send the user back to. That's where the "App address" on the consent screen comes from. Since only claude.ai can put a file on claude.ai, what the user is really trusting is the domain.

As mentioned above, the [current MCP spec](https://modelcontextprotocol.io/specification/2026-07-28) recommends CIMD and deprecates the older Dynamic Client Registration. But CIMD isn't actually specific to MCP. It's just plain OAuth, which means any agent could connect to any service without a developer having to set anything up first, so long as the server and client are set up for it. Rhys Sullivan [put it well](https://x.com/RhysSullivan/status/2070311929038680262):

> "the world i'd like to end up in is one where all companies support CIMD OAuth to their MCP server and their OpenAPI spec."

As of today, few, if any, agent-facing client's are built for CIMD OAuth, which just shows the usefulness of the MCP standard in this case.

Let's take a step back and consider the permissions scope we saw in the login screen. The checkboxes come from Linkly's [one list of permissions](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/shared/scopes.ts), the same list the operations check (`requireScope(p, "links:write")` in Step 1). Here are a few rules to make them work well:

- **Write includes read.** Updating a link returns the whole link, so "write but not read" would be a false promise. So in Linkly, ticking write ticks read too.
- **Each approval is a grant, and it's re-read on every request.** Untick "View click analytics" on the Connected apps page, and the analytics tools are gone on the agent's next request.
- **Users can narrow a grant, never widen it.** They can remove and restore permissions later, but never allow more than the app asked for.
- **Tokens are short-lived.** Access tokens last an hour. Refresh tokens last 30 days and are replaced on every use. If an old one shows up again, Linkly assumes it was stolen and revokes the connection.

Whether someone logs in through the dashboard, an OAuth grant, or a personal access token, they end up as the same kind of caller, a [`Principal`](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/shared/principal.ts). That way, the operations don't need to know or care how someone logged in.

And the nice thing is that this is one step instead of two because the REST API sits behind the same authorization server. `/api/v1` answers with the same `401`, pointing at its own metadata (`…/oauth-protected-resource/api/v1`), and the same consent screen issues its tokens. Each token only works on the surface it was issued for, so if you send an MCP token to the API, Linkly answers with: "This token was issued for https://myapp.com/mcp, not https://myapp.com/api/v1."

There are also personal access tokens. You create one in Linkly's settings, pick its permissions, and it works on both surfaces. Linkly's CLI uses one too (more in Step 5).

There's a catch, though. When you add Linkly's MCP URL to Claude Code, Claude Code runs this whole login for you: it reads the `401`, opens the browser, stores the token, and refreshes it. Every MCP client does this, because the MCP spec tells them to. But if you point an agent at Linkly's REST API instead, all it has is something like `curl`, and I haven't seen an agent run a browser login like this for an API on its own yet. So in practice, you'd hand it a personal access token. For now, the only callers that use OAuth on the API are apps and CLIs that build the login themselves, like a CLI with a `login` command that opens your browser. Still, once the MCP side has OAuth, adding the API to it is a small change, and it'll be ready if agent clients start doing this for regular APIs too.

If your auth provider supports the MCP authorization spec, use it. <!-- TODO: name a few auth providers that support MCP authorization with CIMD (check before publishing) --> Otherwise, every piece above is standard and well documented, so a coding agent can build it from a reference. Hand it Linkly's [`src/oauth/`](https://github.com/vincanger/linkly-api-mcp-cli/tree/main/src/oauth) and [OAuth for agents, explained](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/docs/OAUTH-FOR-AGENTS.md).

So now we can connect to both MCP and API and we know what they should be able to do. But what shouldn't an agent be allowed to do on its own?

## Step 4: Make destructive actions wait for the human

[Notes](./notes.md#step-4-make-destructive-actions-wait-for-the-human)

In [Why MCP](#why-mcp-gets-most-of-your-attention), the email waited on a form question: the client asked "Email 2,043 people?" and sent your answer back to the server. For deletes, Linkly goes a step further. Instead of asking inside the client, the server asks the client to open a page on Linkly, where you confirm logged in as yourself. Here it is in Claude Code:

<!-- TODO: the video is 38 MB, and most blogs won't play an .mp4 inside ![](). Use a <video> tag with a poster frame, or compress it. -->

![Claude Code is asked to delete the link for wasp.sh. It shows "MCP server linkly wants to open a URL: Confirm deleting the link a72vprp in Linkly" with Accept and Decline. A Linkly page opens: "Delete this link?", with the short link, where it goes, and "Requested by Claude Code". After Confirm delete, Claude Code reports the link was deleted.](./assets/elicitation.mp4)

I ask Claude Code to delete the link for wasp.sh. It calls `delete_link`, and instead of a result, Linkly answers with a URL-mode [elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation): a message, "Confirm deleting the link "a72vprp" in Linkly", and a link to a confirmation page. Claude Code asks whether to open it. The page shows the short link, where it goes, and which app asked. I click Confirm delete, Claude Code retries the call, and only then does the link actually get deleted. And the whole time, Claude Code was in auto mode, where it approves most tool calls without asking me, but the delete still waited for me.

So why a page instead of a form "yes"? With a form, the answer comes from the client app, and your server has to trust it. With URL mode, the client's "Accept" only means I agreed to open the page. The confirmation itself happens on Linkly, in my own logged-in session, so Linkly checks its own record of what I clicked, not what the client says. Here's how I'd pick:

- **A form question** for "are you sure?" moments where the client's word is good enough, like the email.
- **A page of yours** for anything that needs the real user: deletes, payments, connecting another account.

Since the 2026-07-28 spec, elicitation is stateless. The server returns the question with a signed `requestState`, and the client retries the same call with the answer, so any server instance can finish it. Two details took me a while to get right:

- **Clients retry as soon as the page opens,** usually before you've clicked anything, so you don't want to ask again. Instead, Linkly waits up to 20 seconds for a decision, tells the client to retry quietly, and after a few rounds falls back to the link.
- **Treat `requestState` as something an attacker could change.** Sign it, tie it to the user and the pending deletion, and let each deletion be confirmed only once.

The [full flow is in the guide](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/docs/GUIDE.md#step-6-make-destructive-actions-wait-for-the-human), with the exact messages.

Most clients can't open a page for you yet, though. Codex and OpenCode can with opt-in settings, and ChatGPT, Claude Desktop, and claude.ai can't. So Linkly checks what each request says the client supports, and everyone else gets the same page as a link in the tool result (`status: "confirmation_required"` with a `confirmUrl`) for the agent to pass along. The REST API does the same with a `202 Accepted`. That's the "bend the API" version from Why MCP, and it's weaker, because the agent hands you the link instead of the client opening it. But it works in every client, so I'd build the link first and then add URL mode on top of it. Both use the same page with the same rules: the link expires after 15 minutes, works once, and only for the user who owns the link, logged in to Linkly.

Why not just mark the tool with `destructiveHint` and let the client handle it? Because it's only a hint. Each client decides what to do with it, some ask and some don't, and your server can't tell which. If the confirmation lives in your server instead, it works the same in every client.

Two last things:

- **Let each connection choose.** The consent screen's "Require confirmation for destructive actions" toggle is on by default and saved with the grant, and users can change it later on the Connected apps page. Dashboard sessions and personal access tokens delete right away: in the dashboard you're already the human, and a script has to run without anyone clicking.
- **Offer a way back.** `delete_link`'s description ends with "Consider update_link with archived: true instead if they might want it back." An archived link stops redirecting, but nothing is lost.

So that covers agents in chat apps, and scripts. But what about agents that have their own shell?

## Step 5: A CLI, if your users have shells

[Notes](./notes.md#step-5-a-cli-if-your-users-have-shells)

A CLI only helps agents with a shell on the user's own machine: Claude Code, Codex, Cursor, or the Code tab in Claude Desktop. Chat apps run code in a remote sandbox that can't see your files. So if your users don't live in a terminal, you can probably skip this step, since MCP already covers them.

If they do, though, a CLI is really good at working with local files. A remote MCP server can't read your disk, so to shorten 500 URLs from a file, the agent has to pass every URL through its context. A CLI reads the file itself:

```bash
# Shorten every URL in a local file
cat urls.txt | xargs -n1 linkly links create

# Export every link to a local file
linkly links list --all --json > links.json
```

The agent only has to write one line, the data goes straight from your disk to the API without passing through the model, and anyone can rerun it later.

Linkly's CLI is just a client of the REST API, with its types [generated from the OpenAPI document](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/cli/src/api.ts). Most of what makes it work well for agents comes down to a few rules:

- **Never prompt.** An agent can't answer an interactive prompt, so the command would just hang. If input is missing, return an error that names the flag to add instead.
- **Print JSON when piped,** in the shape the API documents.
- **Send errors to stderr, with exit codes an agent can branch on:** [2 for usage, 3 unauthorized, 4 forbidden, 5 not found, 6 conflict](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/cli/src/errors.ts#L2-L10). The taken slug from Step 1 ends up as exit code 6.
- **Write `--help` with examples.** That's how an agent figures out how to use your CLI.
- **Require `--yes` for deletes,** and have the error tell the agent exactly what to run:

```
Refusing to delete without --yes. Re-run: linkly links delete summer-sale --yes
```

Keep in mind, though, that `--yes` has the same problem as the `confirm=true` flag from [Why MCP](#why-mcp-gets-most-of-your-attention): the agent can just add it itself. It still helps, because it prevents accidental deletes and makes the delete easy to spot in the command your agent asks to run. But if your agent doesn't need your approval to run commands, nothing is going to wait for you, because to the client it's just another shell command.

Linkly's CLI logs in with a personal access token (`linkly auth login --token lk_pat_...`, or `LINKLY_TOKEN`), saved in a config file only you can read. Since the REST API sits behind the same OAuth server (Step 3), a CLI could open a browser to log in instead, the way most big CLIs do. Linkly's CLI doesn't do that yet, though.

And one thing a CLI does better than MCP: when an agent's command fails, you can rerun it yourself and see what happened. Replaying an MCP call is harder, since you need an inspector for that.

So now all the pieces exist. But can an agent actually find them if all it has is your domain?

## Step 6: Help agents find you from your domain

[Notes](./notes.md#step-6-help-agents-find-you-from-your-domain)

Say a user tells their agent to "use myapp.com". The agent fetches your homepage, and if it's a single-page app, all it gets back is an empty `<div id="root">` and a script tag, with nothing to follow. Once an agent has your MCP URL, Step 3's `401` takes it the rest of the way, but there's no single standard yet for getting from a domain to that URL. Different agents look in different places, so I'd cover all of them. They're cheap, and Linkly does each one:

- **An `llms.txt` at the root of your domain.** It's a short Markdown file that tells an agent how to connect. Linkly [generates it at build time](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/discovery/llmsTxt.ts) from the same paths and docs the app uses, so it can't go stale.
- **A prerendered landing page with a visible "For AI agents" section.** Agents usually fetch your page and read it as text, so the text needs to be in the HTML before any JavaScript runs. Linkly prerenders its homepage and docs (`prerender: true` on the route in Wasp), and the homepage has a ["For AI agents" card](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/app/HomePage.tsx#L45-L63) with the MCP URL and a link to `llms.txt`.
- **Your OpenAPI document at well-known places.** Linkly serves it at `/.well-known/openapi.json` for agents that guess that path, lists it in `/.well-known/api-catalog` (RFC 9727, the one registered path for this), and adds a `Link: <…/openapi.json>; rel="service-desc"` header to [every `/api/v1` response](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/shared/http.ts#L38-L42). Code that follows links finds the document from any API call.

The `llms.txt` only says what the OpenAPI document can't: which way to connect, what to do without OAuth, and the rules. Here's Linkly's, trimmed:

```markdown
# Linkly

> Linkly shortens links and counts their clicks. Everything the dashboard can do, an AI agent can do too: through Linkly's MCP server, or through its REST API.

## MCP (recommended)

- [MCP server](https://myapp.com/mcp): use this if you support MCP (Streamable HTTP). Log in with OAuth in the user's browser: there's no API key to copy and no client registration. On the consent page, the user picks what you may do.

## REST API

- [OpenAPI document](https://myapp.com/api/v1/openapi.json): every endpoint, the scope each one needs, which operations are destructive (`x-destructive`), and how to log in.
- If you're an OAuth client, call an endpoint without a token. The `401` response's `WWW-Authenticate` header points to the login metadata.
- Otherwise, ask the user for a personal access token from [Tokens](/settings/tokens), with only the scopes the task needs (only read scopes if you only read).

## Rules

- Never ask the user for their Linkly password. Log in with OAuth, or ask for a personal access token.
- Ask the user before any operation marked `x-destructive: true` in the OpenAPI document, such as deleting a link.
```

The password rule matters more than it looks. With the user's password, an agent could log in as them directly and skip the consent screen from Step 3, along with every permission the user would have picked there.

All of this is still guesswork on the agent's side, though. The most reliable way in is a URL the user hands over themselves, so Linkly's Connected apps page also has a ["Connect an AI agent" card](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/oauth/ui/ConnectionsPage.tsx#L75-L94) with the MCP URL and a ready prompt to copy: "Read https://myapp.com/llms.txt and connect to my Linkly account."

So now agents can find you, connect, and use everything you've built. That also means your app has a new kind of caller, one that reads everything you send it and retries whenever something fails.

## Risks that come with agent callers

[Notes](./notes.md#risks-that-come-with-agent-callers)

A lot of what makes agent callers risky is already handled by the earlier steps: the model never sees the token, each connection only gets the permissions the user picked, and deletes wait for the human. But there are two risks worth thinking about on their own.

- **Prompt injection through your own data.** Everything your tools return ends up in the model's context, and the model can't always tell data apart from instructions. So it's worth asking who can write the text your tools send back. In Linkly, anyone who clicks a short link controls the `Referer` header, and referrers show up in `get_link_stats`. That's a stranger's text landing in the user's agent. So Linkly [only keeps the hostname](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/analytics/clicks.ts#L26-L34), like `news.ycombinator.com`, and never returns the visitor's user agent at all. You can't filter out every planted instruction, so limit what outsiders can write, and keep the earlier defenses in place. That way, even an agent that gets fooled can only do what the user allowed, and it still can't delete anything without them.
- **Retries and loops.** Agents retry a lot, and a confused one can call the same tool over and over. Rate-limit per connection, not just per user, so one runaway agent doesn't lock the user out of their own dashboard. And answer with a `429` and a `Retry-After` header, so the agent knows to wait instead of trying again right away. Linkly doesn't do this yet, since I left rate limiting out to keep the example small, but I'd add it before letting real agents in.

Those are the big ones. The rest are smaller things, but agents notice them too.

## Small things agents notice

[Notes](./notes.md#small-things-agents-notice)

Most of the mistakes I'd warn you about are already covered in the steps above. These are a few smaller things that still make a real difference to an agent using your app:

- **Accept the identifiers people actually use.** People know a Linkly link by its slug, not its ID, so `get_link` takes either one.
- **Make every error say what to do next.** When a link doesn't exist, Linkly answers: `Link "abc" not found. Use list_links to find valid IDs or slugs.` The agent can recover on its own instead of guessing.
- **Add a "who am I" tool.** Linkly's `whoami` returns the account, its permissions, and whether deletes need confirmation, so an agent can check what it's allowed to do before it tries.
- **Test with a few real clients, not just one.** I'd start with Claude Code on localhost, then use a tunnel for claude.ai and ChatGPT, since they only connect to a public HTTPS URL. Clients really do differ: only some of them open Step 4's confirmation page, for example.
- **If you want, add tests that catch drift.** When you write each surface by hand, it's easy to add something to MCP and forget the API. Linkly's [parity test](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/src/mcp/parity.test.ts#L10-L35) maps every dashboard operation to an MCP tool, or to a reason it's dashboard-only, and [another](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/tests/destructiveFlags.test.ts) checks that every surface agrees on what's destructive.

All of these will hold up for a while. Some of what I've described earlier won't, though, because the space is still moving fast.

## Where this is going

[Notes](./notes.md#where-this-is-going)

Most of what's in this post should hold up for a long time: operations underneath, task-shaped tools on top, one login for every surface, and destructive actions that wait for the human. The details around them are still moving quickly, though. Here's where things stand as of October 2026:

- **The protocol went stateless** in the 2026-07-28 revision, and clients are still catching up.
- **CIMD is the recommended way for clients to identify themselves,** and Dynamic Client Registration is deprecated, but CIMD itself is still an IETF draft, and client support varies.
- **Elicitation, MCP Apps, and Events work in some clients and not others.** URL-mode elicitation, for example, works in the Claude Code CLI, in Codex and OpenCode with a setting turned on, and not yet in ChatGPT (support for form-mode is there though), Claude Desktop, or claude.ai. Events shipped in ChatGPT, while this MCP spec is still a draft.
- **Code mode** is spreading through agent frameworks and servers like Cloudflare's, but the current advice is to let the MCP client implement tool search and code mode, NOT the MCP server!

<!-- TODO: the client-support table (Claude Code / Claude apps / ChatGPT / Codex / Cursor × form elicitation, URL elicitation, MCP Apps, Events) was cut because every cell was unverified. Bring it back only if you can fill and date every cell. -->

None of that changes the design, and it's why every feature in this post has a fallback, which is almost always a link. When a client adds support, the better version just starts working for your users.

If you want to build this yourself, the easiest way is to hand this guide and Linkly to your coding agent as a reference. [The repo](https://github.com/vincanger/linkly-api-mcp-cli) has every piece from this post, [the guide](https://github.com/vincanger/linkly-api-mcp-cli/blob/main/docs/GUIDE.md) 

Linkly is built with [Wasp](https://wasp.sh), and a lot of the plumbing here, like turning operations into MCP tools and REST routes, or running the OAuth server, is the kind of thing we'd like Wasp to handle for you automatically. So [look out for these features](https://github.com/orgs/wasp-lang/projects/5) as part of the Wasp framework in the very near future! 

Needless to say, I'm a big fan of where these tools are headed, especially MCP. Agents are going to be a big part of how people use your app, and it's a good time to start building for them.
