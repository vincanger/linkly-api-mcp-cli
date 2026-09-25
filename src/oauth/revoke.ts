// POST /oauth/revoke (RFC 7009). Always succeeds so callers can't probe tokens.
import type { PrismaClient } from "@prisma/client";
import { sha256Hex } from "../shared/crypto";
import { revokeGrantCascade } from "./grants";

export async function revokeToken(prisma: PrismaClient, token: string | undefined, now = new Date()): Promise<void> {
  if (!token) return;
  const hash = sha256Hex(token);
  const access = await prisma.accessToken.findUnique({ where: { tokenHash: hash } });
  if (access) {
    // A PAT can be revoked here too; that's harmless and convenient.
    if (!access.revokedAt) await prisma.accessToken.update({ where: { id: access.id }, data: { revokedAt: now } });
    return;
  }
  const refresh = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  // Revoking a refresh token ends the whole connection (and its access tokens).
  if (refresh) await revokeGrantCascade(prisma, refresh.grantId, now);
}
