// Connected apps: one Grant per user + client. Tokens hang off the grant,
// and principals are built from it at request time, so edits here apply to
// existing tokens on their next request.
import type { PrismaClient } from "@prisma/client";
import { DomainError } from "../shared/errors";
import { requireSession, type Principal } from "../shared/principal";
import { capScopes, normalizeScopes, type Scope } from "../shared/scopes";

export type Deps = { prisma: PrismaClient; now?: () => Date };

export type GrantOut = {
  id: string;
  clientId: string;
  clientName: string;
  clientHost: string;
  scopes: Scope[];
  /** What the app asked for: the most the user can grant it. */
  requestedScopes: Scope[];
  confirmDestructive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function revokeGrantCascade(prisma: PrismaClient, grantId: string, now: Date): Promise<void> {
  await prisma.$transaction([
    prisma.grant.updateMany({ where: { id: grantId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.accessToken.updateMany({ where: { grantId, revokedAt: null }, data: { revokedAt: now } }),
  ]);
}

export async function listGrants(p: Principal, { prisma }: Deps): Promise<GrantOut[]> {
  requireSession(p, "Managing connected apps");
  const grants = await prisma.grant.findMany({
    where: { userId: p.userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { accessTokens: { select: { lastUsedAt: true }, orderBy: { lastUsedAt: { sort: "desc", nulls: "last" } }, take: 1 } },
  });
  return grants.map((g) => ({
    id: g.id,
    clientId: g.clientId,
    clientName: g.clientName,
    clientHost: safeHost(g.clientId),
    scopes: normalizeScopes(g.scopes),
    requestedScopes: normalizeScopes(g.requestedScopes),
    confirmDestructive: g.confirmDestructive,
    createdAt: g.createdAt.toISOString(),
    lastUsedAt: g.accessTokens[0]?.lastUsedAt?.toISOString() ?? null,
  }));
}

export async function updateGrant(
  p: Principal,
  input: { id: string; scopes?: string[]; confirmDestructive?: boolean },
  { prisma }: Deps,
): Promise<void> {
  requireSession(p, "Managing connected apps");
  const grant = await prisma.grant.findFirst({ where: { id: input.id, userId: p.userId, revokedAt: null } });
  if (!grant) throw new DomainError("not_found", "Connected app not found.");
  await prisma.grant.update({
    where: { id: grant.id },
    data: {
      // Like consent: the user can narrow or restore, never exceed what the app asked for.
      scopes: input.scopes ? capScopes(input.scopes, grant.requestedScopes) : undefined,
      confirmDestructive: input.confirmDestructive,
    },
  });
}

export async function revokeGrant(p: Principal, input: { id: string }, { prisma, now = () => new Date() }: Deps): Promise<void> {
  requireSession(p, "Managing connected apps");
  const grant = await prisma.grant.findFirst({ where: { id: input.id, userId: p.userId, revokedAt: null } });
  if (!grant) throw new DomainError("not_found", "Connected app not found.");
  await revokeGrantCascade(prisma, grant.id, now());
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
