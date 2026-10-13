// HTTP plumbing shared by the REST API, the MCP endpoint, and OAuth.
// This is a Wasp adapter file: framework-free logic lives in bearer.ts.
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { MiddlewareConfigFn } from "wasp/server";
import { prisma } from "wasp/server";
import { OPENAPI_PATH } from "../discovery/paths";
import { authenticateBearer, type BearerTarget } from "./bearer";
import { toErrorResponse, toHttpResponse } from "./errors";
import type { Principal } from "./principal";
import { serverUrl } from "./urls";

/**
 * Permissive CORS for /api/v1, /mcp, /oauth, and /.well-known. Browser-based
 * MCP clients call these from arbitrary origins with bearer tokens (never
 * cookies), so any origin is allowed.
 */
export const permissiveCors: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Protocol-Version, Mcp-Session-Id, Link");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

const withPermissiveCors: MiddlewareConfigFn = (config) => {
  config.set("cors", permissiveCors);
  return config;
};

/** RFC 8631: every /api/v1 response points at the machine-readable API description. */
export const serviceDescLink: RequestHandler = (_req, res, next) => {
  res.setHeader("Link", `<${serverUrl()}${OPENAPI_PATH}>; rel="service-desc"`);
  next();
};

export const restMiddleware: MiddlewareConfigFn = (config) => {
  withPermissiveCors(config);
  config.set("serviceDesc", serviceDescLink);
  return config;
};
export const mcpMiddleware: MiddlewareConfigFn = withPermissiveCors;
export const oauthMiddleware: MiddlewareConfigFn = withPermissiveCors;
export const wellKnownMiddleware: MiddlewareConfigFn = withPermissiveCors;

export function protectedResourceMetadataUrl(target: BearerTarget): string {
  return `${serverUrl()}/.well-known/oauth-protected-resource/${target === "mcp" ? "mcp" : "api/v1"}`;
}

/**
 * Wraps a handler so it only runs with a valid bearer token, and receives the
 * Principal. On failure: 401 with a WWW-Authenticate header pointing at the
 * protected-resource metadata, so clients can discover the auth server.
 */
export function withBearer(
  target: BearerTarget,
  handler: (req: Request, res: Response, principal: Principal) => Promise<unknown> | unknown,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    let principal: Principal;
    try {
      principal = await authenticateBearer(prisma, req.headers.authorization, target);
    } catch (e) {
      const { status, body } = toErrorResponse(e);
      if (status === 401) {
        res.setHeader(
          "WWW-Authenticate",
          `Bearer resource_metadata="${protectedResourceMetadataUrl(target)}"`,
        );
      }
      res.status(status).json(body);
      return;
    }
    try {
      await handler(req, res, principal);
    } catch (e) {
      if (!res.headersSent) toHttpResponse(e, res);
    }
  };
}

/** For public endpoints: same error handling, no auth. */
export function publicHandler(
  handler: (req: Request, res: Response) => Promise<unknown> | unknown,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      if (!res.headersSent) toHttpResponse(e, res);
    }
  };
}

type Handler = (req: Request, res: Response) => Promise<void> | void;

/**
 * Dispatches one path to per-method handlers. Wasp's `api()` has no PATCH,
 * so routes that need it are declared with "ALL" and routed here; any other
 * method gets 405 with an Allow header.
 */
export function byMethod(handlers: Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", Handler>>): Handler {
  const allowed = Object.keys(handlers).join(", ");
  return async (req, res) => {
    const handler = handlers[req.method.toUpperCase() as keyof typeof handlers];
    if (!handler) {
      res.setHeader("Allow", allowed);
      res.status(405).json({ error: { code: "method_not_allowed", message: `Use one of: ${allowed}.` } });
      return;
    }
    await handler(req, res);
  };
}
