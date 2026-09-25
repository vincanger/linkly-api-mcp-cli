// Personal access tokens: the "just ship your API spec" baseline for
// scripts and the CLI. Only a logged-in dashboard session can manage them.
import type { AccessToken, PrismaClient } from "@prisma/client";
import { generateSecret, sha256Hex, TOKEN_PREFIX } from "../shared/crypto";
import { DomainError } from "../shared/errors";
import { requireSession, type Principal } from "../shared/principal";
import { normalizeScopes } from "../shared/scopes";
import { parseInput } from "../shared/validate";
import { PatInput, type PatOut } from "./schemas";

export type Deps = { prisma: PrismaClient; now?: () => Date };

function toPatOut(t: AccessToken): PatOut {
  return {
    id: t.id,
    name: t.name ?? "",
    scopes: t.scopes,
    createdAt: t.createdAt.toISOString(),
    expiresAt: t.expiresAt?.toISOString() ?? null,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    revokedAt: t.revokedAt?.toISOString() ?? null,
  };
}

/** Returns the raw token exactly once; only its hash is stored. */
export async function createPat(
  p: Principal,
  input: PatInput,
  { prisma, now = () => new Date() }: Deps,
): Promise<{ token: string; pat: PatOut }> {
  requireSession(p, "Creating personal access tokens");
  const data = parseInput(PatInput, input);
  const token = generateSecret(TOKEN_PREFIX.pat);
  const expiresAt = data.expiresInDays ? new Date(now().getTime() + data.expiresInDays * 86_400_000) : null;
  const row = await prisma.accessToken.create({
    data: {
      tokenHash: sha256Hex(token),
      kind: "pat",
      userId: p.userId,
      name: data.name,
      scopes: normalizeScopes(data.scopes),
      audience: null,
      expiresAt,
    },
  });
  return { token, pat: toPatOut(row) };
}

export async function listPats(p: Principal, { prisma }: Deps): Promise<PatOut[]> {
  requireSession(p, "Listing personal access tokens");
  const rows = await prisma.accessToken.findMany({
    where: { userId: p.userId, kind: "pat", revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPatOut);
}

export async function revokePat(p: Principal, input: { id: string }, { prisma, now = () => new Date() }: Deps): Promise<PatOut> {
  requireSession(p, "Revoking personal access tokens");
  const row = await prisma.accessToken.findFirst({ where: { id: input.id, userId: p.userId, kind: "pat" } });
  if (!row) throw new DomainError("not_found", "Token not found.");
  const updated = await prisma.accessToken.update({ where: { id: row.id }, data: { revokedAt: row.revokedAt ?? now() } });
  return toPatOut(updated);
}
