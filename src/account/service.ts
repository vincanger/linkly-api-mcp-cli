import type { PrismaClient } from "@prisma/client";
import { dashboardUrls } from "../deeplinks/urls";
import type { Principal } from "../shared/principal";
import { normalizeScopes, toolsetsForScopes } from "../shared/scopes";
import type { Whoami } from "./schemas";

export type Deps = { prisma: PrismaClient };

/** Who is calling and with which permissions. Needs no scope: it reveals only the caller's own identity. */
export async function whoami(p: Principal, { prisma }: Deps): Promise<Whoami> {
  const identity = await prisma.authIdentity.findFirst({
    where: { providerName: "username", auth: { userId: p.userId } },
    select: { providerUserId: true },
  });
  const scopes = normalizeScopes(p.scopes);
  return {
    userId: p.userId,
    username: identity?.providerUserId ?? null,
    source: p.source,
    scopes,
    toolsets: toolsetsForScopes(scopes),
    confirmDestructive: p.confirmDestructive,
    clientName: p.clientName ?? null,
    dashboardUrl: dashboardUrls.links(),
  };
}
