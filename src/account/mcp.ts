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
          "Returns the Linkly account you're connected to: email, permissions (scopes), enabled toolsets, and whether deletions need the user's confirmation. Call it first if you're unsure what you can do: tools you lack permission for (for example create_link without write access) aren't listed.",
        input: {},
        output: Whoami.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: (p) => whoami(p, { prisma }),
      }),
    ),
  ];
}
