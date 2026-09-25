import { expect, test } from "@playwright/test";
import { SERVER_URL } from "./env";
import { apiClient } from "./fixtures/api";
import { db } from "./fixtures/db";
import { connectMcp, textOf } from "./fixtures/mcp";
import { authorizeUrl, consent, oauthTokens, pkcePair, startTestClient, tokenRequest, type TestClient } from "./fixtures/testClient";
import { createVerifiedUser, gotoReady, logIn, type TestUser } from "./fixtures/users";

let client: TestClient;
let user: TestUser;

test.beforeAll(async () => {
  client = await startTestClient("Test Client");
});
test.afterAll(async () => {
  await client.close();
});
test.beforeEach(async () => {
  user = await createVerifiedUser();
});

test.describe("M4: OAuth with CIMD", () => {
  test("metadata endpoints describe the auth server and resources", async () => {
    const as = await (await fetch(`${SERVER_URL}/.well-known/oauth-authorization-server`)).json();
    expect(as).toMatchObject({
      issuer: SERVER_URL,
      token_endpoint: `${SERVER_URL}/oauth/token`,
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
    });
    const mcp = await (await fetch(`${SERVER_URL}/.well-known/oauth-protected-resource/mcp`)).json();
    expect(mcp).toMatchObject({ resource: `${SERVER_URL}/mcp`, authorization_servers: [SERVER_URL] });
    const api = await (await fetch(`${SERVER_URL}/.well-known/oauth-protected-resource/api/v1`)).json();
    expect(api.resource).toBe(`${SERVER_URL}/api/v1`);
  });

  test("log in, consent, exchange the code, and use the token", async ({ page }) => {
    const { verifier, challenge } = pkcePair();
    const url = authorizeUrl(client, challenge, { resource: `${SERVER_URL}/api/v1` });

    // Consent screen shows the client name and the client_id host.
    await page.goto(url);
    await page.waitForURL(/\/login$/);
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByTestId("client-name")).toHaveText("Test Client");
    await expect(page.getByTestId("client-host")).toHaveText("localhost");
    await expect(page.getByText("Linkly hasn't verified this app")).toBeVisible();
    await page.getByLabel("Analytics", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Allow" }).click();
    await page.waitForURL(/127\.0\.0\.1:\d+\/callback/);

    const cb = client.lastCallback()!;
    expect(cb.code).toMatch(/^lk_code_/);
    expect(cb.iss).toBe(SERVER_URL);
    expect(cb.state).toBe(new URL(url).searchParams.get("state"));

    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code: cb.code!,
      code_verifier: verifier,
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
    });
    expect(tokens.status).toBe(200);
    expect(tokens.body.scope).toBe("links:read links:write");

    // The token works on the REST API and has only the chosen scopes.
    const api = apiClient(tokens.body.access_token);
    const me = await api("GET", "/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ source: "oauth", clientName: "Test Client", scopes: ["links:read", "links:write"], confirmDestructive: true });
    expect((await api("GET", "/analytics/top-links")).status).toBe(403);

    // Refresh rotates; reusing the old refresh token revokes the grant.
    const refreshed = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.body.refresh_token, client_id: client.clientId });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refresh_token).not.toBe(tokens.body.refresh_token);
    expect((await apiClient(refreshed.body.access_token)("GET", "/me")).status).toBe(200);

    const reused = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.body.refresh_token, client_id: client.clientId });
    expect(reused.status).toBe(400);
    expect(reused.body.error).toBe("invalid_grant");
    expect((await apiClient(refreshed.body.access_token)("GET", "/me")).status).toBe(401);
  });

  test("Deny redirects back with access_denied", async ({ page }) => {
    const { challenge } = pkcePair();
    await consent(page, user, authorizeUrl(client, challenge), { deny: true });
    expect(client.lastCallback()).toMatchObject({ code: null, error: "access_denied" });
  });

  test("a redirect_uri that isn't in the metadata shows an error and never redirects", async ({ page }) => {
    const before = client.callbacks.length;
    const { challenge } = pkcePair();
    const url = authorizeUrl(client, challenge, { redirect_uri: "http://127.0.0.1:1/evil" });
    await page.goto(url);
    await page.waitForURL(/\/login$/);
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByTestId("authorize-error")).toContainText("redirect_uri");
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe("/oauth/authorize");
    expect(client.callbacks.length).toBe(before);
  });

  test("the connections page lists and revokes the grant", async ({ page }) => {
    const { verifier, challenge } = pkcePair();
    await consent(page, user, authorizeUrl(client, challenge));
    const cb = client.lastCallback()!;
    const tokens = await tokenRequest({ grant_type: "authorization_code", code: cb.code!, code_verifier: verifier, client_id: client.clientId, redirect_uri: client.redirectUri });
    expect(tokens.status).toBe(200);

    await page.goto("/settings/connections");
    const row = page.getByTestId("grant-Test Client");
    await expect(row).toContainText("localhost");
    await row.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText("No connected apps")).toBeVisible();
    const refused = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.body.refresh_token });
    expect(refused.body.error).toBe("invalid_grant");
  });
});

test.describe("M5: MCP client over OAuth", () => {
  test("the MCP SDK client completes OAuth headless and calls tools", async ({ page }) => {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
    const { UnauthorizedError } = await import("@modelcontextprotocol/sdk/client/auth.js");

    let authorizationUrl: URL | null = null;
    let verifier = "";
    let tokens: Record<string, unknown> | undefined;
    const provider = {
      get redirectUrl() {
        return client.redirectUri;
      },
      get clientMetadata() {
        return { client_name: "Test Client", redirect_uris: [client.redirectUri], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
      },
      // The CIMD URL is our client_id. (The SDK only sends clientMetadataUrl
      // when it's https, so the local http test client provides it directly.)
      clientInformation: () => ({ client_id: client.clientId }),
      tokens: () => tokens as never,
      saveTokens: (t: Record<string, unknown>) => void (tokens = t),
      redirectToAuthorization: (url: URL) => void (authorizationUrl = url),
      saveCodeVerifier: (v: string) => void (verifier = v),
      codeVerifier: () => verifier,
    };

    const url = new URL(`${SERVER_URL}/mcp`);
    const mcpClient = new Client({ name: "oauth-e2e", version: "1.0.0" });
    let transport = new StreamableHTTPClientTransport(url, { authProvider: provider });
    await expect(mcpClient.connect(transport)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(authorizationUrl).not.toBeNull();
    expect(authorizationUrl!.searchParams.get("resource")).toBe(`${SERVER_URL}/mcp`);

    // The "user" logs in and clicks Allow in a real browser.
    await consent(page, user, authorizationUrl!.toString());
    await transport.finishAuth(client.lastCallback()!.code!);

    transport = new StreamableHTTPClientTransport(url, { authProvider: provider });
    await mcpClient.connect(transport);
    const tools = (await mcpClient.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["whoami", "list_links", "create_link", "get_link_stats"]));
    const who = await mcpClient.callTool({ name: "whoami", arguments: {} });
    expect(who.structuredContent).toMatchObject({ source: "oauth", clientName: "Test Client", confirmDestructive: true });
    const created = await mcpClient.callTool({ name: "create_link", arguments: { destinationUrl: "https://example.com/oauth" } });
    expect(created.isError).toBeFalsy();
    await mcpClient.close();

    // The MCP token is bound to /mcp: the REST API rejects it.
    const accessToken = (tokens as { access_token: string }).access_token;
    expect((await apiClient(accessToken)("GET", "/me")).status).toBe(401);
  });
});

test.describe("M7: deletions that need confirmation", () => {
  test("delete_link returns a confirm URL; confirming in the browser deletes the link", async ({ page }) => {
    const tokens = await oauthTokens(page, client, user); // "Require confirmation" is on by default
    const mcp = await connectMcp(tokens.access_token);
    try {
      const created = await mcp.call("create_link", { destinationUrl: "https://example.com/confirm-me" });
      const { id, slug } = created.structuredContent as { id: string; slug: string };

      const res = await mcp.call("delete_link", { id });
      const { status, confirmUrl } = res.structuredContent as { status: string; confirmUrl: string };
      expect(status).toBe("confirmation_required");
      expect((await mcp.call("get_link", { id })).isError).toBeFalsy(); // not deleted yet

      await gotoReady(page, new URL(confirmUrl).pathname);
      await expect(page.getByText(`/r/${slug}`)).toBeVisible();
      await expect(page.getByTestId("requested-by")).toHaveText("Test Client");
      await page.getByRole("button", { name: "Confirm delete" }).click();
      await expect(page.getByTestId("action-completed")).toBeVisible();

      const gone = await mcp.call("get_link", { id });
      expect(gone.isError).toBe(true);
      expect(textOf(gone)).toMatch(/^not_found/);

      // Confirming twice fails gracefully: the page shows it's already done.
      await gotoReady(page, new URL(confirmUrl).pathname);
      await expect(page.getByTestId("action-completed")).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm delete" })).toHaveCount(0);
    } finally {
      await mcp.close();
    }
  });

  test("a different user or an expired request can't confirm", async ({ page, browser }) => {
    const tokens = await oauthTokens(page, client, user);
    const mcp = await connectMcp(tokens.access_token);
    try {
      const a = (await mcp.call("create_link", { destinationUrl: "https://example.com/a" })).structuredContent as { id: string };
      const b = (await mcp.call("create_link", { destinationUrl: "https://example.com/b" })).structuredContent as { id: string };
      const urlA = ((await mcp.call("delete_link", { id: a.id })).structuredContent as { confirmUrl: string }).confirmUrl;
      const urlB = ((await mcp.call("delete_link", { id: b.id })).structuredContent as { confirmUrl: string }).confirmUrl;

      // Another user, in a separate browser session.
      const stranger = await createVerifiedUser();
      const other = await browser.newPage();
      await logIn(other, stranger);
      await gotoReady(other, new URL(urlA).pathname);
      await expect(other.getByText("Confirmation not found")).toBeVisible();
      await other.close();
      expect((await mcp.call("get_link", { id: a.id })).isError).toBeFalsy();

      // Expired: move the expiry into the past.
      await db.pendingAction.update({ where: { id: new URL(urlB).pathname.split("/").pop()! }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await gotoReady(page, new URL(urlB).pathname);
      await expect(page.getByTestId("action-expired")).toBeVisible();
      expect((await mcp.call("get_link", { id: b.id })).isError).toBeFalsy();
    } finally {
      await mcp.close();
    }
  });

  test("with confirmation off, deletion is immediate", async ({ page }) => {
    const tokens = await oauthTokens(page, client, user, { confirmDestructive: false });
    const mcp = await connectMcp(tokens.access_token);
    try {
      const { id } = (await mcp.call("create_link", { destinationUrl: "https://example.com/now" })).structuredContent as { id: string };
      expect((await mcp.call("delete_link", { id })).structuredContent).toMatchObject({ status: "deleted", id });
    } finally {
      await mcp.close();
    }
  });
});

test.describe("M8: toolsets", () => {
  const CORE = ["get_dashboard_url", "read_doc", "search_docs", "whoami"];
  const ANALYTICS = ["get_link_stats", "get_top_links"];
  const LINKS = ["create_link", "delete_link", "get_link", "list_links", "update_link"];

  test("a grant with only Analytics sees core + analytics tools; ?toolsets= narrows but never widens", async ({ page }) => {
    const tokens = await oauthTokens(page, client, user, { uncheck: ["Links"] });
    expect(tokens.scope).toBe("analytics:read");

    const all = await connectMcp(tokens.access_token);
    expect(await all.toolNames()).toEqual([...CORE, ...ANALYTICS].sort());
    const denied = await all.call("list_links");
    expect(denied.isError).toBe(true); // not listed, and not callable either
    await all.close();

    const widened = await connectMcp(tokens.access_token, "?toolsets=links,analytics");
    expect(await widened.toolNames()).toEqual([...CORE, ...ANALYTICS].sort());
    await widened.close();

    const narrowed = await connectMcp(tokens.access_token, "?toolsets=links");
    expect(await narrowed.toolNames()).toEqual(CORE);
    await narrowed.close();
  });

  test("editing a grant on the connections page changes the tool list on the next request", async ({ page }) => {
    const tokens = await oauthTokens(page, client, user);
    let mcp = await connectMcp(tokens.access_token);
    expect(await mcp.toolNames()).toEqual([...CORE, ...ANALYTICS, ...LINKS].sort());
    await mcp.close();

    await gotoReady(page, "/settings/connections");
    const row = page.getByTestId("grant-Test Client");
    await row.getByLabel("Links", { exact: true }).uncheck();
    await expect(page.getByText("Toolsets updated")).toBeVisible();

    // Same token, next request: the Links tools are gone.
    mcp = await connectMcp(tokens.access_token);
    expect(await mcp.toolNames()).toEqual([...CORE, ...ANALYTICS].sort());
    await mcp.close();

    // The confirmation toggle applies immediately too.
    await row.getByRole("switch", { name: "Require confirmation for Test Client" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    mcp = await connectMcp(tokens.access_token);
    expect((await mcp.call("whoami")).structuredContent).toMatchObject({ confirmDestructive: false, scopes: ["analytics:read"] });
    await mcp.close();
  });
});
