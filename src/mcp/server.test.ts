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
  conn = await connectInProcess(p, toolsets);
  return conn;
}

describe("MCP server", () => {
  it("advertises name, version, and instructions", async () => {
    const { client } = await connect(pat());
    expect(client.getServerVersion()).toMatchObject({ name: "linkly" });
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
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

  it("only lists tools the principal's scopes allow, and ?toolsets= only narrows", async () => {
    const names = async (p: Principal, t?: ("links" | "analytics")[]) => {
      const c = await connectInProcess(p, t);
      const { tools } = await c.client.listTools();
      await c.close();
      return tools.map((x) => x.name).sort();
    };
    const analyticsOnly = pat(["analytics:read"]);
    expect(await names(analyticsOnly)).toEqual(["get_link_stats", "get_top_links", "whoami"]);
    expect(await names(analyticsOnly, ["links"])).toEqual(["whoami"]); // can't widen
    expect(await names(pat(), ["analytics"])).toEqual(["get_link_stats", "get_top_links", "whoami"]);
    const readOnly = pat(["links:read"]);
    expect(await names(readOnly)).toEqual(["get_link", "list_links", "whoami"]);
  });
});
