# OAuth for agents, explained

How an AI agent like Claude Code logs in to Linkly, written for anyone new to MCP. It collects the questions that came up while building and testing Linkly's OAuth, with the answers and pointers to the code.

**Watch it first:** [How Claude Code Connects](https://claude.ai/artifact/RMZAmj4Am7cQNUAkW3bMxX) is an animated, step-by-step walkthrough of the whole login. It tracks where every secret, code, and token is after each step. This page is the written companion. Once the concepts are clear, [How OAuth works here](ARCHITECTURE.md#how-oauth-works-here) maps each step to the code, with the exact limits (lifetimes, SSRF rules, token rotation).

- [The big idea: OAuth, flipped](#the-big-idea-oauth-flipped)
- [The login, step by step](#the-login-step-by-step)
- [No registration: Client ID Metadata Documents](#no-registration-client-id-metadata-documents)
- [state and PKCE: the two secrets](#state-and-pkce-the-two-secrets)
- [What the redirect actually carries](#what-the-redirect-actually-carries)
- [Common questions](#common-questions)
- [Trying it yourself](#trying-it-yourself)

## The big idea: OAuth, flipped

Most developers meet OAuth as "Sign in with Google": Google is the provider, and some website is the app asking for access. Here it runs the other way. **Linkly is the provider, and the agent is the app asking for access.** The agent gets its own scoped, revocable token to act on your behalf, without your password.

That's why the consent screen can look surprising. It is a real OAuth consent screen, but it's being used to log an agent in to your app:

```
Allow Claude Code to access your Linkly account?
App address: claude.ai
Linkly hasn't verified this app.

Links      [x] View your links
           [x] Create, edit, and delete your links
Analytics  [x] View click analytics
[on] Require confirmation for destructive actions
                                    [Deny]  [Allow]
```

Three details make it agent-specific:

- **"App address: claude.ai" with no registration.** Explained [below](#no-registration-client-id-metadata-documents).
- **One checkbox per permission.** Standard OAuth scopes, grouped by toolset, so you can allow viewing links without allowing changes. Untick "View click analytics" and the agent never sees those tools.
- **"Require confirmation for destructive actions".** If the agent deletes something, you get a link to confirm in Linkly instead of the deletion happening right away.

## The login, step by step

This is what happens after `claude mcp add --transport http linkly http://localhost:3001/mcp`. The four parties are Claude Code (on your laptop), your browser, Linkly, and claude.ai (which hosts Claude Code's ID card).

| # | What happens | Why |
|---|---|---|
| 1 | Claude Code calls `POST /mcp` with no token. Linkly answers `401` with `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"`. | The only thing you gave the agent is the `/mcp` URL. The 401 tells it where to go next. |
| 2 | Claude Code reads Linkly's metadata (`/.well-known/...`): where the login page is, where the token endpoint is, and `client_id_metadata_document_supported: true`. | Discovery. No setup on either side. |
| 3 | Claude Code makes two random values on your laptop: a `state` and a PKCE `code_verifier`. It hashes the verifier into a `code_challenge` and starts a temporary server on `http://localhost:<port>/callback`. | See [state and PKCE](#state-and-pkce-the-two-secrets). |
| 4 | Claude Code opens your browser at `/oauth/authorize?client_id=https://claude.ai/...&redirect_uri=http://localhost:<port>/callback&state=...&code_challenge=...`. | You have to log in and approve, so the request goes through your browser. |
| 5 | Linkly fetches the `client_id` URL. The JSON there is the app's ID card: its name and its allowed callback addresses. | This replaces registration. |
| 6 | You see the consent screen and click Allow. | You are the security check. |
| 7 | Linkly sends your browser to the callback with a one-time `code`, the same `state`, and `iss`. Claude Code's temporary server catches it and checks the state. | The code is a ticket, not access. |
| 8 | Claude Code sends the code plus the original verifier directly to `POST /oauth/token`. Linkly checks that the verifier hashes to the challenge, then returns an access token and a refresh token. | Only the app that started the login can finish it. |
| 9 | Every MCP call now carries `Authorization: Bearer <access token>`. | Linkly rebuilds your permissions from the grant on every request. |

## No registration: Client ID Metadata Documents

In classic OAuth, a developer registers an app in a console first and gets a client ID and secret. Linkly skips that. The app's **`client_id` is an HTTPS URL**, and the JSON at that URL is a **Client ID Metadata Document (CIMD)**. For example, Claude on the web publishes:

```json
{
  "client_id": "https://claude.ai/oauth/mcp-oauth-client-metadata",
  "client_name": "Claude",
  "client_uri": "https://claude.ai",
  "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
  "grant_types": ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:jwt-bearer"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

Claude Code uses a different one, `https://claude.ai/oauth/claude-code-client-metadata`, with a localhost callback.

**Where Linkly handles it:**

1. The authorization-server metadata advertises `client_id_metadata_document_supported: true` and has no registration endpoint ([`src/oauth/metadata.ts`](../src/oauth/metadata.ts)).
2. The consent page ([`ConsentPage.tsx`](../src/oauth/ui/ConsentPage.tsx)) calls the `getAuthorizeRequest` query, which runs `validateAuthorizeRequest` ([`authorize.ts`](../src/oauth/authorize.ts)).
3. That calls `resolveClient` ([`cimd.ts`](../src/oauth/cimd.ts)), which fetches the document, guarding against requests to internal addresses, and checks that the document's `client_id` equals the URL it was fetched from.
4. The "App address" is the hostname of the `client_id` URL, **not** anything the app claims about itself. Only claude.ai can put a file on claude.ai, so the domain is what you're really trusting. That's also why the screen says "Linkly hasn't verified this app".

**Which fields Linkly uses:** `client_id` (must match the URL), `client_name`, and `redirect_uris`. It stores `client_uri` and ignores the rest: it only supports the authorization code and refresh token grants, for public clients with PKCE, which fits `token_endpoint_auth_method: "none"`.

### "No allowlist", yet `redirect_uris` is a list?

Two different lists:

- **No client allowlist** means Linkly keeps no list of approved apps. Any app that publishes a valid document can connect; nobody at Linkly approves Claude, Cursor, or a new agent in advance.
- **`redirect_uris`** is a list the client publishes about itself, on its own domain. It says: "codes for my `client_id` may only be sent to these addresses." Linkly doesn't create or manage it; it holds each request to what the client declared.

Linkly uses `redirect_uris` four times:

1. The document must have at least one entry.
2. The `redirect_uri` in the authorize request must exactly match one of them. If it doesn't, the page shows an error and **never redirects**, so an attacker can't pair Claude's `client_id` with their own callback to catch the code.
3. After Allow or Deny, the browser is sent to that address.
4. The token request must repeat the same `redirect_uri`.

The exception to exact matching is **loopback** addresses (`http://127.0.0.1:*`, `http://localhost:*`), which match on any port (RFC 8252). That's how Claude Code can pick a free port each time.

### Nothing is "registered" after the first connection either

- The **metadata document** is cached for 24 hours (`OAuthClientCache`). That's a cache, not an approval: it's refetched afterwards, so changes to the document are picked up.
- A **Grant** is created when *you* click Allow. It records your approval for your account only: which app, which scopes you allowed (and which it asked for), and whether deletions need confirmation. It stores no redirect URIs. Another user connecting the same app gets their own consent screen and their own grant.

### Where the standard came from

- **IndieAuth.** The IndieWeb community's OAuth profile used URLs as client IDs years ago, because there's no central place to register when every website is its own provider.
- **The IETF OAuth working group** generalized the idea as the draft "OAuth Client ID Metadata Document" (co-authored by Aaron Parecki, who also wrote much of IndieAuth).
- **The MCP authorization spec** adopted it for the same reason: every MCP server is its own authorization server, so pre-registering with each one doesn't scale. The November 2025 revision recommended CIMD and kept Dynamic Client Registration as a fallback. The 2026-07-28 revision still recommends CIMD, and deprecates Dynamic Client Registration, keeping it only for backwards compatibility. Check the current spec for exact wording.

It's still an IETF draft, not a final RFC, so client support varies. Claude Code supports it; some versions of the MCP Inspector only support Dynamic Client Registration.

## state and PKCE: the two secrets

**Which request carries them:** the `/oauth/authorize` URL the client opens in your browser (step 4).

**When they're created:** right when the client starts connecting (step 3), after it learns where the login page is.

- **`state`** is a random string that identifies this login attempt. It comes back unchanged with the code, so the client knows the answer belongs to a login it actually started.
- **`code_verifier`** is a second random string that stays with the client. Only its hash, the `code_challenge`, goes out in step 4. In step 8 the client reveals the verifier, and Linkly checks that it hashes to the challenge. Someone who grabbed the code from the browser can't do this, because they never saw the verifier.

**Where they're created:** by whichever part of the app will exchange the code for tokens, because that part must still hold the verifier when the code comes back.

- **Claude Code** does everything in the CLI process on your laptop: it generates the secrets in memory, catches the redirect on its temporary localhost server, calls the token endpoint itself, and stores the tokens locally. No Anthropic server is involved.
- **Claude on the web** receives the redirect on `claude.ai/api/mcp/auth_callback`, a route on Anthropic's servers, so its server must generate and hold the verifier (inferred from the protocol; the internals aren't public).

In this repo, the MCP SDK client asks the app to handle `saveCodeVerifier()`, `codeVerifier()`, and `saveTokens()`. The end-to-end test implements them in a few lines (the M5 step in [`e2e/oauth.spec.ts`](../e2e/oauth.spec.ts)).

## What the redirect actually carries

Linkly never sends anything to the client directly in step 7. It sends **your browser** to the client's callback:

```
http://localhost:<port>/callback
  ?code=lk_code_7Hq…         one-time code: 60 seconds, single use
  &state=a81f3c…             echoed back from step 4
  &iss=http://localhost:3001 which authorization server issued the code
```

- **`code`** is a ticket, not access. It's useless without the verifier.
- **`state`** proves this redirect answers the client's own request.
- **`iss`** stops a code from a different server being swapped in.

The real credentials (`access_token`, `refresh_token`) only travel in step 8, in the direct reply from `POST /oauth/token` to the client. They never pass through the browser.

The callback isn't a separate "helper" server. For Claude on the web it's one route on claude.ai that receives the redirect from **every** MCP server a user connects; `state` tells it which attempt each redirect belongs to. Claude Code, which has no website, runs a tiny temporary server on your laptop instead, catches the redirect, and shuts it down.

## Common questions

**Do I need to be logged in to Linkly?** Only to approve. The consent screen has to know whose account the agent gets; if you're not logged in, Linkly sends you to its login page and back. After that the agent has its own tokens and renews them by itself, so logging out of Linkly doesn't affect it. It stops working when you revoke it on `/settings/connections`, or if it goes unused until its refresh token expires.

**What if a client has no domain or metadata document?** The document only needs to be a JSON file at a stable HTTPS URL; a static host like GitHub Pages is enough, and the app doesn't have to run there. Linkly also accepts `http://localhost` client IDs in development. Otherwise the client can connect with a personal access token as an `Authorization: Bearer` header, or, once optional milestone M11 is built, register itself with Dynamic Client Registration. Linkly deliberately doesn't support manual, admin-issued client IDs, because it has no client allowlist.

**Why does Notion's login URL look different?** Notion chains two logins. Claude Code first talks to `mcp.notion.com`, a separate authorization server just for MCP that receives the same kind of request Linkly does (a CIMD `client_id`, a localhost callback, `state`, and a PKCE challenge). `mcp.notion.com` then starts a *second*, classic OAuth flow with Notion's main app, as a pre-registered integration: a UUID `client_id` and its own `redirect_uri` (`https://mcp.notion.com/callback`). It packs Claude Code's original request into a signed `state`. After you approve, it swaps codes with Notion and sends its own code back to Claude Code's localhost callback. Notion built this adapter so its existing OAuth didn't have to learn CIMD. Linkly is the authorization server itself, so it needs only one hop.

**Why did the MCP Inspector fail with "does not support dynamic client registration"?** That Inspector version only knows how to get a `client_id` by registering. Linkly has no registration endpoint, so the Inspector stops after reading the metadata, before it ever builds the `/oauth/authorize` URL. Nothing on Linkly's side is broken. Connect the Inspector with a token header for now, or build M11.

## Trying it yourself

Connect a client as shown in the [README](../README.md#connect-an-ai-assistant-mcp). To skip OAuth, pass a personal access token from `/settings/tokens` instead:

```bash
claude mcp add --transport http linkly http://localhost:3001/mcp \
  --header "Authorization: Bearer lk_pat_..."
```

Then try "What Linkly account am I connected to?", create a link, ask for its stats, and ask to delete it: with "Require confirmation" on, you get a `/confirm/...` link instead of an immediate deletion. The connection appears on `/settings/connections`, where unticking a permission removes those tools on the agent's next request.
