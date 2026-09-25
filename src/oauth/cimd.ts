// Client ID Metadata Documents: the OAuth `client_id` is an HTTPS URL that
// serves a JSON description of the client. Any client with a valid document
// can connect: there is no allowlist. The consent screen is the boundary.
import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainError } from "../shared/errors";
import { fetchJsonGuarded, isAllowedLoopbackClient, LOOPBACK_HOSTNAMES, SsrfError } from "./ssrf";

export type ClientMetadata = {
  clientId: string;
  clientName: string;
  clientHost: string;
  redirectUris: string[];
  clientUri?: string;
  logoUri?: string;
};

export type CimdDeps = {
  prisma: PrismaClient;
  now?: () => Date;
  fetchDocument?: (url: URL, allowLoopback: boolean) => Promise<unknown>;
  nodeEnv?: string;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Errors about the client itself: the authorize page shows them and never redirects. */
export class InvalidClientError extends DomainError {
  constructor(message: string) {
    super("invalid", message);
    this.name = "InvalidClientError";
  }
}

/** Step 1: `client_id` must be an https URL with a path (or local-dev loopback http). */
export function parseClientIdUrl(clientId: string, nodeEnv = process.env.NODE_ENV): URL {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    throw new InvalidClientError("client_id must be a URL pointing to the client's metadata document.");
  }
  const loopbackDev = isAllowedLoopbackClient(url, nodeEnv);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopbackDev)) {
    throw new InvalidClientError("client_id must be an https:// URL.");
  }
  if (url.pathname === "/" || url.pathname === "") throw new InvalidClientError("client_id URL must include a path.");
  if (url.hash || url.username || url.password) throw new InvalidClientError("client_id URL must not contain credentials or a fragment.");
  if (LOOPBACK_HOSTNAMES.has(url.hostname) && !loopbackDev) {
    throw new InvalidClientError("client_id can't point at localhost.");
  }
  return url;
}

/** Step 4: validates the fetched document. */
export function validateMetadataDocument(clientId: string, doc: unknown): ClientMetadata {
  if (!doc || typeof doc !== "object") throw new InvalidClientError("The client metadata document must be a JSON object.");
  const d = doc as Record<string, unknown>;
  if (d.client_id !== clientId) {
    throw new InvalidClientError("The client metadata document's client_id doesn't match the URL it was fetched from.");
  }
  const redirectUris = d.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every((u) => typeof u === "string")) {
    throw new InvalidClientError("The client metadata document must list at least one redirect_uris entry.");
  }
  for (const uri of redirectUris as string[]) {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new InvalidClientError(`Invalid redirect URI in client metadata: ${uri}`);
    }
    if (parsed.hash) throw new InvalidClientError("Redirect URIs must not contain a fragment.");
  }
  const host = new URL(clientId).hostname;
  const name = typeof d.client_name === "string" && d.client_name.trim() ? d.client_name.trim().slice(0, 100) : host;
  return {
    clientId,
    clientName: name,
    clientHost: host,
    redirectUris: redirectUris as string[],
    clientUri: typeof d.client_uri === "string" ? d.client_uri : undefined,
    logoUri: typeof d.logo_uri === "string" ? d.logo_uri : undefined,
  };
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

/**
 * Step 5: exact match, except loopback redirects (http://127.0.0.1:*,
 * http://localhost:*) match regardless of port (RFC 8252 §7.3).
 */
export function redirectUriMatches(requested: string, registered: string[]): boolean {
  if (registered.includes(requested)) return true;
  let req: URL;
  try {
    req = new URL(requested);
  } catch {
    return false;
  }
  if (req.protocol !== "http:" || !isLoopbackHost(req.hostname)) return false;
  return registered.some((r) => {
    try {
      const reg = new URL(r);
      return (
        reg.protocol === "http:" &&
        reg.hostname === req.hostname &&
        reg.pathname === req.pathname &&
        reg.search === req.search
      );
    } catch {
      return false;
    }
  });
}

/** Resolves a client: cache (24h), else fetch with SSRF guards, then validate. */
export async function resolveClient(clientId: string, deps: CimdDeps): Promise<ClientMetadata> {
  const { prisma, now = () => new Date(), nodeEnv = process.env.NODE_ENV } = deps;
  const url = parseClientIdUrl(clientId, nodeEnv);

  const cached = await prisma.oAuthClientCache.findUnique({ where: { clientId } });
  if (cached && now().getTime() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return validateMetadataDocument(clientId, cached.metadata);
  }

  const allowLoopback = isAllowedLoopbackClient(url, nodeEnv);
  const fetchDocument = deps.fetchDocument ?? ((u: URL, loop: boolean) => fetchJsonGuarded(u, { allowLoopback: loop }));
  let doc: unknown;
  try {
    doc = await fetchDocument(url, allowLoopback);
  } catch (e) {
    if (e instanceof SsrfError) throw new InvalidClientError(e.message);
    throw new InvalidClientError(`Couldn't fetch the client metadata document: ${(e as Error).message}`);
  }
  const metadata = validateMetadataDocument(clientId, doc);
  await prisma.oAuthClientCache.upsert({
    where: { clientId },
    create: { clientId, metadata: doc as Prisma.InputJsonValue, fetchedAt: now() },
    update: { metadata: doc as Prisma.InputJsonValue, fetchedAt: now() },
  });
  return metadata;
}
