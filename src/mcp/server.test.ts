import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { principalFromGrant, principalFromPat, principalFromSession, type Principal } from "../shared/principal";
import { createTestUser, prisma, resetDb } from "../test/db";
import { SERVER_INSTRUCTIONS } from "./server";
import { connectInProcess } from "./testClient";

let conn: Awaited<ReturnType<typeof connectInProcess>> | null = null;
let userId: string;

beforeEach(async () => {
  await resetDb();
  userId = (await createTestUser()).id;
});
afterEach(async () => {
  await conn?.close();
  conn = null;
});

const pat = (scopes: string[] = ["links:read", "links:write", "analytics:read"]) =>
  principalFromPat({ userId, scopes: scopes as never });

async function connect(p: Principal, toolsets?: ("links" | "analytics")[]) {
  conn = await connectInProcess(p, { toolsets });
  return conn;
}

describe("MCP server", () => {
  it("advertises name, version, and instructions", async () => {
    const { client } = await connect(pat());
    expect(client.getServerVersion()).toMatchObject({ name: "linkly" });
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
  });

  it("speaks 2026-07-28, and still serves 2025-era clients", async () => {
    const { client } = await connect(pat());
    expect(client.getProtocolEra()).toBe("modern");
    const legacy = await connectInProcess(pat(), { era: "legacy" });
    try {
      expect(legacy.client.getProtocolEra()).toBe("legacy");
      expect(legacy.client.getServerVersion()).toMatchObject({ name: "linkly" });
      expect((await legacy.client.listTools()).tools.map((t) => t.name)).toContain("delete_link");
    } finally {
      await legacy.close();
    }
  });

  it("lists tools with input and output schemas and annotations", async () => {
    const { client } = await connect(pat());
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(Object.keys(byName)).toEqual(
      expect.arrayContaining(["whoami", "list_links", "get_link", "create_link", "update_link", "delete_link", "get_link_stats", "get_top_links"]),
    );
    expect(byName.delete_link!.annotations).toMatchObject({ destructiveHint: true });
    expect(byName.list_links!.annotations).toMatchObject({ readOnlyHint: true });
    expect(byName.create_link!.inputSchema.required).toEqual(["destinationUrl"]);
    expect(byName.get_link_stats!.outputSchema?.properties).toHaveProperty("dashboardUrl");
  });

  it("creates, lists, reads stats, and returns structured content", async () => {
    const { call } = await connect(pat());
    const created = await call("create_link", { destinationUrl: "https://example.com", slug: "via-mcp", tags: ["mcp"] });
    expect(created.isError).toBeFalsy();
    expect(created.structuredContent).toMatchObject({ slug: "via-mcp", shortUrl: "http://localhost:3001/r/via-mcp" });
    expect(JSON.parse((created.content as { text: string }[])[0]!.text)).toMatchObject({ slug: "via-mcp" });

    const list = await call("list_links", { tag: "mcp" });
    expect((list.structuredContent as { data: unknown[] }).data).toHaveLength(1);

    const stats = await call("get_link_stats", { linkId: "via-mcp", range: "7d" });
    expect(stats.structuredContent).toMatchObject({ total: 0, dashboardUrl: expect.stringContaining("tab=stats") });

    const who = await call("whoami");
    expect(who.structuredContent).toMatchObject({ userId, source: "pat", toolsets: ["links", "analytics"] });
  });

  it("returns actionable errors as tool results", async () => {
    const { call } = await connect(pat());
    const missing = await call("get_link", { id: "nope" });
    expect(missing.isError).toBe(true);
    expect((missing.content as { text: string }[])[0]!.text).toBe('not_found: Link "nope" not found. Use list_links to find valid IDs or slugs.');
    await call("create_link", { destinationUrl: "https://a.com", slug: "taken" });
    const conflict = await call("create_link", { destinationUrl: "https://b.com", slug: "taken" });
    expect((conflict.content as { text: string }[])[0]!.text).toMatch(/^conflict: .*already taken/);
  });

  it("deletes immediately for PATs", async () => {
    const { call } = await connect(pat());
    await call("create_link", { destinationUrl: "https://a.com", slug: "bye-bye" });
    const res = await call("delete_link", { id: "bye-bye" });
    expect(res.structuredContent).toMatchObject({ status: "deleted", slug: "bye-bye" });
  });

  it("returns a confirmation link when the grant requires it", async () => {
    const setup = principalFromSession({ id: userId });
    const { createLink } = await import("../links/service");
    await createLink(setup, { destinationUrl: "https://a.com", slug: "keep-me" }, { prisma });
    const grant = principalFromGrant({ id: "g1", userId, clientName: "Claude", scopes: ["links:read", "links:write"], confirmDestructive: true });
    const { call } = await connect(grant);
    const res = await call("delete_link", { id: "keep-me" });
    expect(res.structuredContent).toMatchObject({
      status: "confirmation_required",
      confirmUrl: expect.stringMatching(/^http:\/\/localhost:3000\/confirm\/[0-9a-f-]{36}$/),
      message: expect.stringContaining("Share this link with the user"),
    });
    expect(await prisma.link.count({ where: { slug: "keep-me" } })).toBe(1);
    const action = await prisma.pendingAction.findFirstOrThrow({ where: { userId } });
    expect(action.requestedBy).toBe("Claude");
  });

  it("exposes docs as tools for everyone and as docs:// resources", async () => {
    const { client, call } = await connect(pat([]));
    const search = await call("search_docs", { query: "how are clicks counted" });
    expect((search.structuredContent as { results: { slug: string }[] }).results[0]!.slug).toBe("how-clicks-are-counted");
    const doc = await call("read_doc", { slug: "tags" });
    expect(doc.structuredContent).toMatchObject({ slug: "tags", title: "Tags" });
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain("docs://linkly/how-clicks-are-counted");
    const read = await client.readResource({ uri: "docs://linkly/tags" });
    expect(read.contents[0]).toMatchObject({ mimeType: "text/markdown", text: expect.stringContaining("# Tags") });
  });

  it("builds dashboard URLs for agents", async () => {
    const { call } = await connect(pat([]));
    const stats = await call("get_dashboard_url", { view: "link", id: "promo", params: { range: "30d" } });
    expect(stats.structuredContent).toEqual({ view: "link", url: "http://localhost:3000/links/promo?tab=stats&range=30d" });
    const form = await call("get_dashboard_url", { view: "newLink", params: { destinationUrl: "https://a.com", tags: ["x"] } });
    expect((form.structuredContent as { url: string }).url).toBe("http://localhost:3000/links/new?destinationUrl=https%3A%2F%2Fa.com&tags=x");
    const missingId = await call("get_dashboard_url", { view: "link" });
    expect(missingId.isError).toBe(true);
  });

  it("only lists tools the principal's scopes allow, and ?toolsets= only narrows", async () => {
    const names = async (p: Principal, t?: ("links" | "analytics")[]) => {
      const c = await connectInProcess(p, { toolsets: t });
      const { tools } = await c.client.listTools();
      await c.close();
      return tools.map((x) => x.name).sort();
    };
    const analyticsOnly = pat(["analytics:read"]);
    expect(await names(analyticsOnly)).toEqual(["get_dashboard_url", "get_link_stats", "get_top_links", "read_doc", "search_docs", "whoami"]);
    expect(await names(analyticsOnly, ["links"])).toEqual(["get_dashboard_url", "read_doc", "search_docs", "whoami"]); // can't widen
    expect(await names(pat(), ["analytics"])).toEqual(["get_dashboard_url", "get_link_stats", "get_top_links", "read_doc", "search_docs", "whoami"]);
    const readOnly = pat(["links:read"]);
    expect(await names(readOnly)).toEqual(["get_dashboard_url", "get_link", "list_links", "read_doc", "search_docs", "whoami"]);
  });
});
