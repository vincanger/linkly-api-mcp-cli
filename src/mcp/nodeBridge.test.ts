import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, expect, it } from "vitest";
import { principalFromGrant, type Principal } from "../shared/principal";
import { createTestUser, prisma, resetDb } from "../test/db";
import { sendWebResponse, toWebRequest } from "./nodeBridge";
import { authInfoFor, linklyMcpHandler } from "./server";

// Over real HTTP through Express, like handler.ts. A buffered bridge passes
// every request/response test but hangs subscriptions/listen, so clients that
// open it while connecting (Claude Code does) took 20-25s to connect.

let principal: Principal;
let close: () => Promise<void>;
let url: string;

beforeEach(async () => {
  await resetDb();
  const user = await createTestUser();
  principal = principalFromGrant({ id: "g1", userId: user.id, clientName: "Claude", scopes: ["links:read"], confirmDestructive: true });
  const handler = linklyMcpHandler({ prisma, log: () => {} });
  const app = express();
  app.post("/mcp", express.json(), async (req, res) => {
    const base = `http://localhost:${(server.address() as AddressInfo).port}`;
    await sendWebResponse(res, await handler.fetch(toWebRequest(req, res, base), { authInfo: authInfoFor(principal), parsedBody: req.body }));
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}/mcp`;
  close = async () => {
    await handler.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
});
afterEach(async () => {
  await close();
});

it("streams subscriptions/listen, so a client that opens it on connect connects right away", async () => {
  const client = new Client(
    { name: "test", version: "1.0.0" },
    { capabilities: {}, versionNegotiation: { mode: "auto" }, listChanged: { tools: { onChanged: () => {} } } as never },
  );
  const started = Date.now();
  await client.connect(new StreamableHTTPClientTransport(new URL(url)), { timeout: 5_000 });
  expect(Date.now() - started).toBeLessThan(2_000);
  expect(client.autoOpenedSubscription).toBeDefined();
  expect((await client.listTools()).tools.map((t) => t.name)).toContain("list_links");
  await client.close();
});
