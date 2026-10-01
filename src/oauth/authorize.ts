// The authorization request: validation, consent approval, and denial.
// Used by the consent page's Wasp operations.
import type { PrismaClient } from "@prisma/client";
import { generateSecret, sha256Hex, TOKEN_PREFIX } from "../shared/crypto";
import { requireSession, type Principal } from "../shared/principal";
import { ALL_SCOPES, capScopes, isScope, normalizeScopes, type Scope } from "../shared/scopes";
import { apiResourceUrl, mcpResourceUrl, serverUrl } from "../shared/urls";
import { InvalidClientError, redirectUriMatches, resolveClient, type CimdDeps } from "./cimd";

export const CODE_TTL_MS = 60_000;

export type AuthorizeParams = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  resource?: string;
};

export type ValidAuthorizeRequest = {
  ok: true;
  clientId: string;
  clientName: string;
  clientHost: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  resource: string;
  /** Scopes the client asked for (all scopes if it didn't ask). The consent screen offers these, pre-checked. */
  requestedScopes: Scope[];
};

/** A problem the client should hear about: the page redirects back with `error=`. */
export type RedirectableAuthorizeError = { ok: false; redirectTo: string; error: string; errorDescription: string };

export function authorizeRedirect(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries({ ...params, iss: serverUrl() })) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * Validates an authorization request. Invalid `client_id` or `redirect_uri`
 * throws InvalidClientError: the page shows an error and never redirects,
 * because the redirect target itself can't be trusted. Other problems are
 * returned as redirectable errors.
 */
export async function validateAuthorizeRequest(
  params: AuthorizeParams,
  deps: CimdDeps,
): Promise<ValidAuthorizeRequest | RedirectableAuthorizeError> {
  if (!params.client_id) throw new InvalidClientError("The request is missing client_id.");
  const client = await resolveClient(params.client_id, deps);
  if (!params.redirect_uri) throw new InvalidClientError("The request is missing redirect_uri.");
  if (!redirectUriMatches(params.redirect_uri, client.redirectUris)) {
    throw new InvalidClientError("redirect_uri isn't one of the redirect URIs in the client's metadata document.");
  }

  const fail = (error: string, errorDescription: string): RedirectableAuthorizeError => ({
    ok: false,
    error,
    errorDescription,
    redirectTo: authorizeRedirect(params.redirect_uri!, { error, error_description: errorDescription, state: params.state }),
  });

  if (params.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  if (!params.code_challenge || !/^[A-Za-z0-9_-]{43,128}$/.test(params.code_challenge)) {
    return fail("invalid_request", "PKCE is required: send a code_challenge.");
  }
  if (params.code_challenge_method !== "S256") return fail("invalid_request", "code_challenge_method must be S256.");

  let requestedScopes: Scope[];
  if (params.scope && params.scope.trim()) {
    const requested = params.scope.trim().split(/\s+/);
    const unknown = requested.filter((s) => !isScope(s));
    if (unknown.length) return fail("invalid_scope", `Unknown scope: ${unknown.join(", ")}.`);
    requestedScopes = normalizeScopes(requested);
  } else {
    requestedScopes = [...ALL_SCOPES];
  }

  const resource = params.resource ? params.resource.replace(/\/+$/, "") : mcpResourceUrl();
  if (resource !== mcpResourceUrl() && resource !== apiResourceUrl()) {
    return fail("invalid_target", `resource must be ${mcpResourceUrl()} or ${apiResourceUrl()}.`);
  }

  return {
    ok: true,
    clientId: client.clientId,
    clientName: client.clientName,
    clientHost: client.clientHost,
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
    state: params.state,
    resource,
    requestedScopes,
  };
}

export async function approveAuthorization(
  p: Principal,
  input: { params: AuthorizeParams; scopes: string[]; confirmDestructive: boolean },
  deps: CimdDeps & { prisma: PrismaClient },
): Promise<{ redirectTo: string }> {
  requireSession(p, "Approving an app");
  const req = await validateAuthorizeRequest(input.params, deps);
  if (!req.ok) return { redirectTo: req.redirectTo };

  const code = generateSecret(TOKEN_PREFIX.code);
  const now = (deps.now ?? (() => new Date()))();
  await deps.prisma.authorizationCode.create({
    data: {
      codeHash: sha256Hex(code),
      userId: p.userId,
      clientId: req.clientId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      // Granted: what the user ticked, never more than the client asked for.
      scopes: capScopes(input.scopes, req.requestedScopes),
      requestedScopes: req.requestedScopes,
      resource: req.resource,
      confirmDestructive: input.confirmDestructive,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });
  return { redirectTo: authorizeRedirect(req.redirectUri, { code, state: req.state }) };
}

export async function denyAuthorization(
  p: Principal,
  input: { params: AuthorizeParams },
  deps: CimdDeps,
): Promise<{ redirectTo: string }> {
  requireSession(p, "Denying an app");
  const req = await validateAuthorizeRequest(input.params, deps);
  if (!req.ok) return { redirectTo: req.redirectTo };
  return {
    redirectTo: authorizeRedirect(req.redirectUri, {
      error: "access_denied",
      error_description: "The user denied the request.",
      state: req.state,
    }),
  };
}
