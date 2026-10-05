// Linkly's docs, as data. `{{serverUrl}}` and `{{appUrl}}` are filled in when
// a doc is read, so examples show the real URLs of this deployment.
export type Doc = { slug: string; title: string; tags: string[]; body: string };

export const DOCS: Doc[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    tags: ["overview", "basics"],
    body: `Linkly turns long URLs into short links and counts how often they're clicked.

1. **Create a link** on the Links page: paste the destination URL, optionally pick a slug.
2. **Share the short URL**: \`{{serverUrl}}/r/<slug>\`. Each visit redirects to the destination and is counted.
3. **Watch the clicks** on the link's Stats tab or on Top links.

Everything in the dashboard is also available through the [REST API](/docs/rest-api), the [\`linkly\` CLI](/docs/cli), and an [MCP server](/docs/connecting-ai-clients) for AI assistants.`,
  },
  {
    slug: "links-and-slugs",
    title: "Links and slugs",
    tags: ["links", "slugs", "short url"],
    body: `A **link** has a destination URL, a **slug**, an optional title, and up to 10 tags.

The slug is the short code in the short URL: \`{{serverUrl}}/r/<slug>\`.

- Slugs are 3–40 characters: lowercase letters, numbers, and hyphens.
- Slugs are unique across all of Linkly. If one is taken you'll get a conflict error: pick another.
- Leave the slug empty to get a random 7-character one.
- Changing a slug changes the short URL; the old one stops working.

**Archiving** a link stops its short URL from redirecting (visitors see "not found") and hides it from the default list, without deleting its history. Unarchive it to bring it back.

Anywhere Linkly asks for a link, you can pass its ID or its slug.`,
  },
  {
    slug: "tags",
    title: "Tags",
    tags: ["tags", "organize", "filter"],
    body: `Tags group links, for example by campaign (\`summer-sale\`) or channel (\`newsletter\`).

- Up to 10 tags per link, each up to 30 characters.
- Tags are stored in lowercase, so \`Promo\` and \`promo\` are the same tag.
- Filter the Links page (or \`list_links\`, \`GET /api/v1/links?tag=\`) by one tag.
- Updating a link's tags replaces the whole list.`,
  },
  {
    slug: "how-clicks-are-counted",
    title: "How clicks are counted",
    tags: ["clicks", "analytics", "counting", "referrer", "privacy"],
    body: `A click is counted every time someone opens a short URL and is redirected.

How clicks are counted:

- **Every redirect counts**, including repeat visits from the same person. Linkly doesn't deduplicate visitors.
- **Archived or deleted links** don't redirect, so their visits aren't counted.
- **Referrer**: only the hostname of the referring page is stored (for example \`news.ycombinator.com\`), never the full URL. Visits without a referrer are grouped as \`direct\`.
- **User agent**: stored, truncated to 200 characters. Linkly doesn't store IP addresses or locations.
- Clicks are recorded right after the redirect is sent, so a click shows up in stats within a moment.

Deleting a link deletes its clicks too.`,
  },
  {
    slug: "analytics-ranges",
    title: "Analytics time ranges",
    tags: ["analytics", "ranges", "stats", "charts"],
    body: `Stats and top links take a **range**:

| Range | Covers |
|---|---|
| \`24h\` | The last 24 hours, exactly |
| \`7d\` | Today and the 6 previous days (UTC) |
| \`30d\` | Today and the 29 previous days (UTC) |
| \`90d\` | Today and the 89 previous days (UTC) |

Stats can be grouped **by day** (one entry per UTC day, including days with zero clicks, so charts have no gaps) or **by referrer** (one entry per referring website, most clicks first).

Every stats result includes a \`dashboardUrl\` that opens the same chart in Linkly.`,
  },
  {
    slug: "connecting-ai-clients",
    title: "Connecting AI assistants (MCP)",
    tags: ["mcp", "ai", "claude", "oauth", "connect", "assistant"],
    body: `Linkly has an MCP server, so AI assistants can manage your links for you.

**Connect:** add this URL as a custom connector (or MCP server) in your assistant:

\`\`\`
{{serverUrl}}/mcp
\`\`\`

The assistant opens Linkly's consent page. Pick what it [may do](/docs/toolsets-and-permissions) (for example, view your links but not change them), choose whether deletions need your confirmation, and click **Allow**. There's no API key to copy and no app registration: Linkly accepts any app that publishes a client metadata document, and shows you its address before you approve.

**Manage** connected apps on [Connections]({{appUrl}}/settings/connections): change permissions, toggle confirmations, or disconnect. Changes apply on the app's next request.

For clients that only support a static header, create a [personal access token]({{appUrl}}/settings/tokens) and send \`Authorization: Bearer <token>\`.`,
  },
  {
    slug: "toolsets-and-permissions",
    title: "Toolsets and permissions",
    tags: ["permissions", "scopes", "toolsets", "security", "oauth"],
    body: `Permissions are **scopes**:

| Scope | Allows |
|---|---|
| \`links:read\` | View your links |
| \`links:write\` | Create, edit, and delete your links |
| \`analytics:read\` | View click analytics |

On the consent screen, each scope is its own checkbox, grouped into **toolsets**: **Links** (\`links:read\`, \`links:write\`) and **Analytics** (\`analytics:read\`). You can allow viewing links without allowing changes. Ticking a write scope also ticks its read scope, since changing a link also shows it. An app only gets the scopes it asked for and you approved, and only sees the MCP tools those scopes allow. On Connections you can remove scopes later or restore them, up to what the app asked for.

Some tools are always available because they don't touch your data: \`whoami\`, \`search_docs\`, \`read_doc\`, and \`get_dashboard_url\`.

MCP clients can also narrow the tool list with \`?toolsets=links,analytics\` on the MCP URL. That can only hide tools, never add them.`,
  },
  {
    slug: "deleting-links",
    title: "Deleting links",
    tags: ["delete", "confirmation", "safety", "archive"],
    body: `Deleting a link removes it and its click history permanently.

- **In the dashboard**, you confirm in a dialog.
- **Connected apps (OAuth)** follow your setting for that connection. With **Require confirmation** on (the default), the app gets a confirmation link instead of deleting: nothing happens until you open it and click **Confirm**. Some AI apps open the page for you after asking; others share the link. The link expires after 15 minutes.
- **Personal access tokens and the CLI** delete immediately (the CLI requires \`--yes\`).

If you might want the link back, **archive** it instead: it stops redirecting but keeps its history.`,
  },
  {
    slug: "rest-api",
    title: "REST API",
    tags: ["api", "rest", "openapi", "tokens", "http"],
    body: `The REST API lives at \`{{serverUrl}}/api/v1\` and is described by an OpenAPI 3.1 document:

\`\`\`
{{serverUrl}}/api/v1/openapi.json
\`\`\`

**Authenticate** with a [personal access token]({{appUrl}}/settings/tokens) (or an OAuth token issued for \`resource={{serverUrl}}/api/v1\`):

\`\`\`bash
curl -H "Authorization: Bearer $LINKLY_TOKEN" {{serverUrl}}/api/v1/links
\`\`\`

| Method | Path | |
|---|---|---|
| GET | \`/me\` | Who the token belongs to |
| GET | \`/links\` | List (\`search\`, \`tag\`, \`archived\`, \`cursor\`, \`limit\`) |
| POST | \`/links\` | Create |
| GET / PATCH / DELETE | \`/links/{id}\` | Read, update, delete (ID or slug) |
| GET | \`/links/{id}/stats\` | Clicks (\`range\`, \`groupBy\`) |
| GET | \`/analytics/top-links\` | Most-clicked links |
| GET | \`/docs/search?q=\`, \`/docs/{slug}\` | These docs (public) |

Lists return \`{ data, nextCursor }\`. Errors return \`{ error: { code, message } }\`. Every operation declares \`x-destructive\`; only deleting a link is destructive.`,
  },
  {
    slug: "cli",
    title: "The linkly CLI",
    tags: ["cli", "command line", "terminal", "scripts"],
    body: `The \`linkly\` CLI wraps the REST API. It's built for people and for AI agents with a shell: it never prompts, prints JSON when piped, and uses clear exit codes.

\`\`\`bash
linkly auth login --token lk_pat_...     # or set LINKLY_TOKEN
linkly links create https://example.com --slug launch --tag promo
linkly links list --tag promo --json | jq '.data[].shortUrl'
linkly stats launch --range 30d
linkly links delete launch --yes          # deletes need --yes
\`\`\`

Point it at a server with \`--url\` or \`LINKLY_URL\` (default \`{{serverUrl}}\`). Exit codes: 0 ok, 1 unexpected, 2 usage, 3 unauthorized, 4 forbidden, 5 not found, 6 conflict.`,
  },
];
