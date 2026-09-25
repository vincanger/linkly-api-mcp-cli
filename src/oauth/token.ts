// POST /oauth/token logic: authorization_code (with PKCE) and refresh_token
// (single-use rotation with reuse detection). Returns RFC 6749 shapes.
import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { generateSecret, sha256Hex, TOKEN_PREFIX } from "../shared/crypto";
import { normalizeScopes } from "../shared/scopes";
import { resolveClient, type CimdDeps } from "./cimd";
import { revokeGrantCascade } from "./grants";

export const ACCESS_TOKEN_TTL_S = 3600;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type TokenResult =
  | { status: 200; body: { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string } }
  | { status: 400 | 401; body: { error: string; error_description: string } };

type Deps = CimdDeps & { prisma: PrismaClient };

const oauthError = (error: string, error_description: string, status: 400 | 401 = 400): TokenResult => ({
  status,
  body: { error, error_description },
});

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function exchangeToken(params: Record<string, unknown>, deps: Deps): Promise<TokenResult> {
  const p = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
  switch (p.grant_type) {
    case "authorization_code":
      return exchangeCode(p, deps);
    case "refresh_token":
      return refresh(p, deps);
    case undefined:
      return oauthError("invalid_request", "grant_type is required.");
    default:
      return oauthError("unsupported_grant_type", "Supported grant types: authorization_code, refresh_token.");
  }
}

async function exchangeCode(p: Record<string, string | undefined>, deps: Deps): Promise<TokenResult> {
  const { prisma } = deps;
  const now = (deps.now ?? (() => new Date()))();
  if (!p.code || !p.redirect_uri || !p.client_id || !p.code_verifier) {
    return oauthError("invalid_request", "code, redirect_uri, client_id, and code_verifier are required.");
  }

  const code = await prisma.authorizationCode.findUnique({ where: { codeHash: sha256Hex(p.code) } });
  if (!code) return oauthError("invalid_grant", "The authorization code is invalid.");

  // Single use: claim the code atomically. A second use means the code
  // leaked, so the grant it created is revoked.
  const claimed = await prisma.authorizationCode.updateMany({ where: { id: code.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count === 0) {
    const used = await prisma.authorizationCode.findUnique({ where: { id: code.id } });
    if (used?.grantId) await revokeGrantCascade(prisma, used.grantId, now);
    return oauthError("invalid_grant", "The authorization code was already used. The connection it created has been revoked.");
  }
  if (code.expiresAt <= now) return oauthError("invalid_grant", "The authorization code has expired.");
  if (code.clientId !== p.client_id) return oauthError("invalid_grant", "client_id doesn't match the authorization request.");
  if (code.redirectUri !== p.redirect_uri) return oauthError("invalid_grant", "redirect_uri doesn't match the authorization request.");
  if (pkceChallenge(p.code_verifier) !== code.codeChallenge) return oauthError("invalid_grant", "PKCE verification failed.");

  const client = await resolveClient(code.clientId, deps).catch(() => null);
  const clientName = client?.clientName ?? new URL(code.clientId).hostname;

  // One grant per user + client; re-consent updates it.
  const existing = await prisma.grant.findFirst({ where: { userId: code.userId, clientId: code.clientId, revokedAt: null } });
  const grant = existing
    ? await prisma.grant.update({
        where: { id: existing.id },
        data: { scopes: code.scopes, confirmDestructive: code.confirmDestructive, clientName },
      })
    : await prisma.grant.create({
        data: { userId: code.userId, clientId: code.clientId, clientName, scopes: code.scopes, confirmDestructive: code.confirmDestructive },
      });
  await prisma.authorizationCode.update({ where: { id: code.id }, data: { grantId: grant.id } });

  return issueTokens(prisma, { userId: code.userId, grantId: grant.id, scopes: grant.scopes, resource: code.resource, now });
}

async function refresh(p: Record<string, string | undefined>, deps: Deps): Promise<TokenResult> {
  const { prisma } = deps;
  const now = (deps.now ?? (() => new Date()))();
  if (!p.refresh_token) return oauthError("invalid_request", "refresh_token is required.");

  const token = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256Hex(p.refresh_token) }, include: { grant: true } });
  if (!token) return oauthError("invalid_grant", "The refresh token is invalid.");

  const claimed = await prisma.refreshToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count === 0) {
    // Reuse of a rotated refresh token: assume it was stolen, revoke everything.
    await revokeGrantCascade(prisma, token.grantId, now);
    return oauthError("invalid_grant", "The refresh token was already used. The connection has been revoked; authorize again.");
  }
  if (token.expiresAt <= now) return oauthError("invalid_grant", "The refresh token has expired.");
  if (token.grant.revokedAt) return oauthError("invalid_grant", "The connection was revoked.");
  if (p.client_id && p.client_id !== token.grant.clientId) return oauthError("invalid_grant", "client_id doesn't match.");
  if (p.resource && p.resource.replace(/\/+$/, "") !== token.resource) {
    return oauthError("invalid_target", "A refresh token can only mint tokens for its original resource.");
  }

  return issueTokens(prisma, {
    userId: token.grant.userId,
    grantId: token.grantId,
    scopes: token.grant.scopes,
    resource: token.resource,
    now,
  });
}

async function issueTokens(
  prisma: PrismaClient,
  g: { userId: string; grantId: string; scopes: string[]; resource: string; now: Date },
): Promise<TokenResult> {
  const accessToken = generateSecret(TOKEN_PREFIX.access);
  const refreshToken = generateSecret(TOKEN_PREFIX.refresh);
  const scopes = normalizeScopes(g.scopes);
  await prisma.$transaction([
    prisma.accessToken.create({
      data: {
        tokenHash: sha256Hex(accessToken),
        kind: "oauth",
        userId: g.userId,
        grantId: g.grantId,
        scopes,
        audience: g.resource,
        expiresAt: new Date(g.now.getTime() + ACCESS_TOKEN_TTL_S * 1000),
      },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: sha256Hex(refreshToken),
        grantId: g.grantId,
        resource: g.resource,
        expiresAt: new Date(g.now.getTime() + REFRESH_TOKEN_TTL_MS),
      },
    }),
  ]);
  return {
    status: 200,
    body: { access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refreshToken, scope: scopes.join(" ") },
  };
}
