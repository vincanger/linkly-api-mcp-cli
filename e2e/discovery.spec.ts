import SwaggerParser from "@apidevtools/swagger-parser";
import { expect, test } from "@playwright/test";
import { CLIENT_URL, SERVER_URL } from "./env";
import { consent, pkcePair, startTestClient, type TestClient } from "./fixtures/testClient";
import { createVerifiedUser, gotoReady, logIn } from "./fixtures/users";

// M10: an agent that's only given the dashboard's address finds its way to a
// REST call, without MCP. Everything it reads is followed from the previous
// response; the only URL it starts with is CLIENT_URL. `wasp start` serves
// prerendered routes as HTML too, so step 1 runs against the dev server.

let client: TestClient;
test.beforeAll(async () => {
  client = await startTestClient("Discovery Agent");
});
test.afterAll(async () => {
  await client.close();
});

/** The visible text of an HTML page, roughly what an agent's fetch tool converts it to. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** The URL of the first Markdown link with this text. */
function markdownLink(md: string, text: string): string {
  const match = md.match(new RegExp(`\\[${text}\\]\\(([^)]+)\\)`));
  if (!match) throw new Error(`No [${text}](...) link in:\n${md}`);
  return match[1]!;
}

test("an agent goes from the dashboard address to a REST call, without MCP", async ({ page }) => {
  const requested: string[] = [];
  const agentFetch = (url: string, init?: RequestInit) => {
    requested.push(url);
    return fetch(url, init);
  };
  page.on("request", (req) => requested.push(req.url()));

  // 1. The homepage, without running JavaScript.
  const homeHtml = await (await agentFetch(`${CLIENT_URL}/`)).text();
  const home = visibleText(homeHtml);
  expect(home).toContain("For AI agents");
  expect(home).toContain(`${SERVER_URL}/mcp`);
  const llmsTxtPath = home.match(/(\S*\/llms\.txt)/)?.[1];
  expect(llmsTxtPath).toBeTruthy();

  // 2. llms.txt names the MCP server and the OpenAPI document.
  const llmsTxtRes = await agentFetch(new URL(llmsTxtPath!, CLIENT_URL).toString());
  expect(llmsTxtRes.status).toBe(200);
  const llmsTxt = await llmsTxtRes.text();
  expect(markdownLink(llmsTxt, "MCP server")).toBe(`${SERVER_URL}/mcp`);
  const openApiUrl = markdownLink(llmsTxt, "OpenAPI document");

  // 3. The OpenAPI document: pick the list-links operation.
  const openApi = await (await agentFetch(openApiUrl)).json();
  const [listPath] = Object.entries(openApi.paths as Record<string, { get?: { operationId?: string } }>).find(
    ([, item]) => item.get?.operationId === "listLinks",
  )!;
  const listUrl = `${openApi.servers[0].url}${listPath}`;

  // 4. Without a token: 401, and the headers lead to the login metadata.
  const unauthorized = await agentFetch(listUrl);
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get("link")).toBe(`<${openApiUrl}>; rel="service-desc"`);
  const resourceMetadataUrl = unauthorized.headers.get("www-authenticate")?.match(/resource_metadata="([^"]+)"/)?.[1];
  expect(resourceMetadataUrl).toBeTruthy();
  const resource = await (await agentFetch(resourceMetadataUrl!)).json();
  expect(resource.resource).toBe(`${SERVER_URL}/api/v1`);
  const issuer: string = resource.authorization_servers[0];
  const as = await (await agentFetch(`${issuer}/.well-known/oauth-authorization-server`)).json();
  expect(as.client_id_metadata_document_supported).toBe(true);

  // 5. OAuth with the CIMD test client (the user's one step is the consent click), then the call.
  const user = await createVerifiedUser();
  const { verifier, challenge } = pkcePair();
  const authorize = new URL(as.authorization_endpoint);
  for (const [k, v] of Object.entries({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "discovery",
    resource: resource.resource,
  })) {
    authorize.searchParams.set(k, v);
  }
  await consent(page, user, authorize.toString());
  const code = client.lastCallback()!.code!;
  const tokenRes = await agentFetch(as.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
    }).toString(),
  });
  expect(tokenRes.status).toBe(200);
  const { access_token } = await tokenRes.json();

  const list = await agentFetch(listUrl, { headers: { Authorization: `Bearer ${access_token}` } });
  expect(list.status).toBe(200);
  expect(await list.json()).toMatchObject({ data: [] });

  expect(requested.filter((url) => new URL(url).pathname.startsWith("/mcp"))).toEqual([]);
});

test("every prerendered page is real HTML before JavaScript runs", async () => {
  const docs = visibleText(await (await fetch(`${CLIENT_URL}/docs`)).text());
  expect(docs).toContain("How clicks are counted");
  const doc = visibleText(await (await fetch(`${CLIENT_URL}/docs/how-clicks-are-counted`)).text());
  expect(doc).toContain("Every redirect counts");
  // Links to the dashboard are root-relative until the page hydrates (there's no window at build time).
  const connecting = await (await fetch(`${CLIENT_URL}/docs/connecting-ai-clients`)).text();
  expect(connecting).toContain('href="/settings/tokens"');
});

test("the OpenAPI document is also at /.well-known/openapi.json, and the API catalog lists it", async () => {
  const wellKnown = await (await fetch(`${SERVER_URL}/.well-known/openapi.json`)).json();
  expect(wellKnown).toEqual(await (await fetch(`${SERVER_URL}/api/v1/openapi.json`)).json());
  await SwaggerParser.validate(wellKnown);

  const catalogRes = await fetch(`${SERVER_URL}/.well-known/api-catalog`);
  expect(catalogRes.headers.get("content-type")).toContain("application/linkset+json");
  const catalog = await catalogRes.json();
  expect(catalog.linkset[0]["service-desc"][0].href).toBe(`${SERVER_URL}/api/v1/openapi.json`);
});

test("the Connections page has the MCP URL and a ready prompt", async ({ page }) => {
  const user = await createVerifiedUser();
  await logIn(page, user);
  await gotoReady(page, "/settings/connections");
  await expect(page.getByTestId("connect-mcp-url")).toHaveText(`${SERVER_URL}/mcp`);
  await expect(page.getByTestId("connect-prompt")).toHaveText(
    `Read ${CLIENT_URL}/llms.txt and connect to my Linkly account.`,
  );
});
