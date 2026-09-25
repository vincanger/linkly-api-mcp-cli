// Wasp api handlers for the OAuth endpoints (framework-free logic lives in
// metadata.ts, token.ts, and revoke.ts).
import type { Request, Response } from "express";
import { prisma } from "wasp/server";
import type {
  OauthRevoke,
  OauthToken,
  WellKnownAuthorizationServer,
  WellKnownProtectedResource,
  WellKnownProtectedResourceApi,
  WellKnownProtectedResourceMcp,
} from "wasp/server/api";
import { authorizationServerMetadata, protectedResourceMetadata } from "./metadata";
import { revokeToken } from "./revoke";
import { exchangeToken } from "./token";

const json = (body: unknown) => (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(body);
};

// The root document describes the MCP server, the resource most clients look for.
export const wellKnownProtectedResource: WellKnownProtectedResource = (req, res) => json(protectedResourceMetadata("mcp"))(req, res);
export const wellKnownProtectedResourceMcp: WellKnownProtectedResourceMcp = (req, res) => json(protectedResourceMetadata("mcp"))(req, res);
export const wellKnownProtectedResourceApi: WellKnownProtectedResourceApi = (req, res) => json(protectedResourceMetadata("api"))(req, res);
export const wellKnownAuthorizationServer: WellKnownAuthorizationServer = (req, res) => json(authorizationServerMetadata())(req, res);

export const oauthToken: OauthToken = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  try {
    const result = await exchangeToken((req.body ?? {}) as Record<string, unknown>, { prisma });
    res.status(result.status).json(result.body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error", error_description: "Something went wrong." });
  }
};

export const oauthRevoke: OauthRevoke = async (req, res) => {
  try {
    await revokeToken(prisma, typeof req.body?.token === "string" ? req.body.token : undefined);
  } catch (e) {
    console.error(e);
  }
  res.status(200).end();
};
