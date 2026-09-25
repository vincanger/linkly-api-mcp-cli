import { expect, test } from "@playwright/test";
import { SERVER_URL } from "./env";
import { apiClient } from "./fixtures/api";
import { authorizeUrl, consent, pkcePair, startTestClient, tokenRequest, type TestClient } from "./fixtures/testClient";
import { createVerifiedUser, type TestUser } from "./fixtures/users";

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
