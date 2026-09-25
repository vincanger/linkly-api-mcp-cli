import { expect, test } from "@playwright/test";
import { CLIENT_URL, SERVER_URL } from "./env";
import { apiClient } from "./fixtures/api";
import { createOAuthTokenFor, createPatFor } from "./fixtures/db";
import { connectMcp } from "./fixtures/mcp";
import { createVerifiedUser } from "./fixtures/users";

const ALL = ["links:read", "links:write", "analytics:read"];

test("MCP over Streamable HTTP: list tools, create, stats, delete", async () => {
  const user = await createVerifiedUser();
  const mcp = await connectMcp(await createPatFor(user.userId, ALL));
  try {
    expect(mcp.client.getServerVersion()?.name).toBe("linkly");
    const tools = await mcp.toolNames();
    expect(tools).toEqual(expect.arrayContaining(["whoami", "list_links", "create_link", "delete_link", "get_link_stats", "get_top_links"]));

    const slug = `mcp-${Date.now()}`;
    const created = await mcp.call("create_link", { destinationUrl: "https://example.com/mcp", slug });
    expect(created.structuredContent).toMatchObject({ slug, shortUrl: `${SERVER_URL}/r/${slug}`, dashboardUrl: expect.stringContaining(CLIENT_URL) });

    await fetch(`${SERVER_URL}/r/${slug}`, { redirect: "manual" });
    await expect
      .poll(async () => ((await mcp.call("get_link_stats", { linkId: slug })).structuredContent as { total: number }).total)
      .toBe(1);

    const docs = await mcp.call("search_docs", { query: "how are clicks counted" });
    expect((docs.structuredContent as { results: { slug: string }[] }).results[0]!.slug).toBe("how-clicks-are-counted");
    const { resources } = await mcp.client.listResources();
    expect(resources.map((r) => r.uri)).toContain("docs://linkly/how-clicks-are-counted");

    // PATs delete immediately.
    const deleted = await mcp.call("delete_link", { id: slug });
    expect(deleted.structuredContent).toMatchObject({ status: "deleted", slug });
  } finally {
    await mcp.close();
  }
});

test("OAuth connections that require confirmation get a confirm URL on MCP and REST", async () => {
  const user = await createVerifiedUser();
  const setup = apiClient(await createPatFor(user.userId, ALL));
  const a = (await setup("POST", "/links", { destinationUrl: "https://example.com/a" })).body;
  const b = (await setup("POST", "/links", { destinationUrl: "https://example.com/b" })).body;

  const mcpToken = await createOAuthTokenFor(user.userId, { scopes: ALL, confirmDestructive: true, audience: `${SERVER_URL}/mcp` });
  const mcp = await connectMcp(mcpToken.token);
  try {
    const res = await mcp.call("delete_link", { id: a.id });
    expect(res.structuredContent).toMatchObject({
      status: "confirmation_required",
      confirmUrl: expect.stringMatching(new RegExp(`^${CLIENT_URL}/confirm/[0-9a-f-]{36}$`)),
    });
    expect((await setup("GET", `/links/${a.id}`)).status).toBe(200);
  } finally {
    await mcp.close();
  }

  const apiToken = await createOAuthTokenFor(user.userId, { scopes: ALL, confirmDestructive: true, audience: `${SERVER_URL}/api/v1` });
  const rest = await apiClient(apiToken.token)("DELETE", `/links/${b.id}`);
  expect(rest.status).toBe(202);
  expect(rest.body).toMatchObject({ status: "confirmation_required", confirmUrl: expect.stringContaining("/confirm/") });
  expect((await setup("GET", `/links/${b.id}`)).status).toBe(200);
});

test("/mcp: 401 with discovery header, 405 for GET, audience enforced", async () => {
  const anonymous = await fetch(`${SERVER_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("www-authenticate")).toBe(
    `Bearer resource_metadata="${SERVER_URL}/.well-known/oauth-protected-resource/mcp"`,
  );
  expect((await fetch(`${SERVER_URL}/mcp`)).status).toBe(405);

  const user = await createVerifiedUser();
  const apiOnly = await createOAuthTokenFor(user.userId, { scopes: ALL, confirmDestructive: false, audience: `${SERVER_URL}/api/v1` });
  await expect(connectMcp(apiOnly.token)).rejects.toThrow();
});
