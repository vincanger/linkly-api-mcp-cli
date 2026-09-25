// Test helper: an MCP SDK client connected in-process to a server built for a principal.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Principal } from "../shared/principal";
import type { Toolset } from "../shared/scopes";
import { prisma } from "../test/db";
import { allTools } from "./registry";
import { allResources } from "./resources";
import { buildServer } from "./server";

export async function connectInProcess(principal: Principal, requestedToolsets?: Toolset[]) {
  const server = buildServer({ principal, tools: allTools({ prisma }), resources: allResources(), requestedToolsets, log: () => {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  return {
    client,
    async call(name: string, args: Record<string, unknown> = {}) {
      return client.callTool({ name, arguments: args });
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}
