import type { PrismaClient } from "@prisma/client";
import { asAny, defineTool } from "../mcp/defineTool";
import { Whoami } from "./schemas";
import { whoami } from "./service";

export function accountTools({ prisma }: { prisma: PrismaClient }) {
  return [
    asAny(
      defineTool({
        name: "whoami",
        title: "Who am I",
        toolset: "core",
        description:
          "Returns the Linkly account you're connected to: username, permissions (scopes), enabled toolsets, and whether deletions need the user's confirmation. Call it first if you're unsure what you can do. Calling a tool you lack permission for (for example create_link without write access) makes the user's app ask them to allow it; if they don't, the call fails.",
        input: {},
        output: Whoami.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: (p) => whoami(p, { prisma }),
      }),
    ),
  ];
}
