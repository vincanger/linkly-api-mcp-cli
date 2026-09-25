import type { PrismaClient } from "@prisma/client";
import { DomainError } from "./errors";
import { principalFromGrant, principalFromPat, type Principal } from "./principal";
import { normalizeScopes } from "./scopes";
import { sha256Hex } from "./crypto";
import { apiResourceUrl, mcpResourceUrl } from "./urls";

export type BearerTarget = "api" | "mcp";

const LAST_USED_THROTTLE_MS = 60_000;

/**
 * Turns an `Authorization: Bearer <token>` header into a Principal.
 * PATs work on both /api/v1 and /mcp. OAuth tokens must carry the audience
 * of the resource they're used on, and take their permissions from the grant.
 */
export async function authenticateBearer(
  prisma: PrismaClient,
  authorization: string | undefined,
  target: BearerTarget,
  now: Date = new Date(),
): Promise<Principal> {
  const raw = parseBearer(authorization);
  if (!raw) throw new DomainError("unauthorized", "Missing bearer token. Send `Authorization: Bearer <token>`.");

  const token = await prisma.accessToken.findUnique({
    where: { tokenHash: sha256Hex(raw) },
    include: { grant: true },
  });
  if (!token || token.revokedAt) throw new DomainError("unauthorized", "The access token is invalid or revoked.");
  if (token.expiresAt && token.expiresAt <= now) throw new DomainError("unauthorized", "The access token has expired.");

  let principal: Principal;
  if (token.kind === "pat") {
    principal = principalFromPat({ userId: token.userId, scopes: normalizeScopes(token.scopes) });
  } else {
    const expected = target === "mcp" ? mcpResourceUrl() : apiResourceUrl();
    if (token.audience !== expected) {
      throw new DomainError("unauthorized", `This token was issued for ${token.audience ?? "another resource"}, not ${expected}.`);
    }
    const grant = token.grant;
    if (!grant || grant.revokedAt) throw new DomainError("unauthorized", "The connection for this token was revoked.");
    principal = principalFromGrant({ ...grant, scopes: normalizeScopes(grant.scopes) });
  }

  if (!token.lastUsedAt || now.getTime() - token.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    // Fire and forget: usage tracking must never slow down or fail a request.
    prisma.accessToken.update({ where: { id: token.id }, data: { lastUsedAt: now } }).catch(() => {});
  }
  return principal;
}

export function parseBearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return match?.[1] ?? null;
}
