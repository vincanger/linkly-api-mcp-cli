// The dashboard's /llms.txt (https://llmstxt.org), the entry point for an
// agent that was only given the dashboard's address. vite.config.ts renders it
// at build time, so it must stay free of `wasp/*` imports.
//
// It only says what the OpenAPI document can't: which way to connect, the
// token fallback, and the rules. Endpoints, scopes, `x-destructive`, and the
// login details are in the OpenAPI document, so this links to it instead.
// API links are absolute. Dashboard links are root-relative, because this
// file is served by the dashboard itself.
import { dashboardPaths } from "../deeplinks/urls";
import { DOCS } from "../docs/content";
import { API_BASE_PATH, MCP_PATH, OPENAPI_PATH } from "./paths";

export function renderLlmsTxt({ serverUrl }: { serverUrl: string }): string {
  const server = serverUrl.replace(/\/+$/, "");
  const mcpUrl = server + MCP_PATH;
  const apiUrl = server + API_BASE_PATH;
  const openApiUrl = server + OPENAPI_PATH;
  const tokensPage = dashboardPaths.tokens();

  return `# Linkly

> Linkly shortens links and counts their clicks. Everything the dashboard can do, an AI agent can do too: through Linkly's MCP server, or through its REST API.

A short link looks like \`${server}/r/<slug>\` and redirects to its destination URL. Each visit is counted. Clicks can be read back by day or by referrer, and links ranked by clicks.

## MCP (recommended)

- [MCP server](${mcpUrl}): use this if you support MCP (Streamable HTTP). Log in with OAuth in the user's browser: there's no API key to copy and no client registration. On the consent page, the user picks what you may do.
- Deleting a link may need the user's confirmation. If your client supports URL-mode elicitation, the confirmation page opens by itself and the call finishes once the user confirms. Otherwise the result has a \`confirmUrl\`: share it with the user, and nothing is deleted until they confirm there.

## REST API

- [OpenAPI document](${openApiUrl}): every endpoint, the scope each one needs, which operations are destructive (\`x-destructive\`), and how to log in.
- Base URL: ${apiUrl}
- If you're an OAuth client, call an endpoint without a token. The \`401\` response's \`WWW-Authenticate\` header points to the login metadata.
- Otherwise, ask the user for a personal access token from [Tokens](${tokensPage}), with only the scopes the task needs (only read scopes if you only read). Send it as \`Authorization: Bearer <token>\`.

## Rules

- Never ask the user for their Linkly password. Log in with OAuth, or ask for a personal access token.
- Ask the user before any operation marked \`x-destructive: true\` in the OpenAPI document, such as deleting a link.
- Keep a personal access token in an environment variable (for example \`LINKLY_TOKEN\`). Check that it's set without printing it, and never write it to output, files, or logs.

## Docs

${DOCS.map((d) => `- [${d.title}](${dashboardPaths.doc(d.slug)})`).join("\n")}
`;
}
