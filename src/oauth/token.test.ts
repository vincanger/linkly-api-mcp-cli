import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { authenticateBearer } from "../shared/bearer";
import { principalFromSession, type Principal } from "../shared/principal";
import { createTestUser, prisma, resetDb } from "../test/db";
import { approveAuthorization, denyAuthorization, validateAuthorizeRequest, type AuthorizeParams } from "./authorize";
import { InvalidClientError } from "./cimd";
import { revokeToken } from "./revoke";
import { exchangeToken, pkceChallenge } from "./token";

const CLIENT_ID = "https://client.example.com/oauth/metadata.json";
const REDIRECT = "http://127.0.0.1:40001/callback";
const MCP = "http://localhost:3001/mcp";
const API = "http://localhost:3001/api/v1";

const fetchDocument = async () => ({ client_id: CLIENT_ID, client_name: "Example Client", redirect_uris: [REDIRECT] });
let deps: { prisma: typeof prisma; fetchDocument: typeof fetchDocument };
let user: Principal;

beforeEach(async () => {
  await resetDb();
  deps = { prisma, fetchDocument };
  user = principalFromSession(await createTestUser());
});

function authParams(verifier: string, overrides: Partial<AuthorizeParams> = {}): AuthorizeParams {
  return {
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    state: "xyz",
    ...overrides,
  };
}

async function authorize(opts: { toolsets?: ("links" | "analytics")[]; confirmDestructive?: boolean; params?: Partial<AuthorizeParams> } = {}) {
  const verifier = randomBytes(32).toString("base64url");
  const { redirectTo } = await approveAuthorization(
    user,
    { params: authParams(verifier, opts.params), toolsets: opts.toolsets ?? ["links", "analytics"], confirmDestructive: opts.confirmDestructive ?? true },
    deps,
  );
  const url = new URL(redirectTo);
  return { verifier, code: url.searchParams.get("code")!, url };
}

const exchange = (code: string, verifier: string, extra: Record<string, string> = {}) =>
  exchangeToken({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: CLIENT_ID, redirect_uri: REDIRECT, ...extra }, deps);

describe("authorization request", () => {
  it("returns the client, requested scopes, and default toolsets", async () => {
    const req = await validateAuthorizeRequest(authParams("v".repeat(43), { scope: "analytics:read" }), deps);
    expect(req).toMatchObject({ ok: true, clientName: "Example Client", clientHost: "client.example.com", requestedScopes: ["analytics:read"], defaultToolsets: ["analytics"], resource: MCP });
  });

  it("never redirects for a bad redirect_uri or client", async () => {
    await expect(validateAuthorizeRequest(authParams("v".repeat(43), { redirect_uri: "https://evil.example/cb" }), deps)).rejects.toThrow(InvalidClientError);
    await expect(validateAuthorizeRequest(authParams("v".repeat(43), { client_id: "https://client.example.com/other.json" }), deps)).rejects.toThrow(/doesn't match/);
  });

  it("redirects back with an error for other problems", async () => {
    const noPkce = await validateAuthorizeRequest(authParams("v".repeat(43), { code_challenge: undefined }), deps);
    expect(noPkce.ok).toBe(false);
    if (!noPkce.ok) {
      const url = new URL(noPkce.redirectTo);
      expect(url.searchParams.get("error")).toBe("invalid_request");
      expect(url.searchParams.get("state")).toBe("xyz");
      expect(url.searchParams.get("iss")).toBe("http://localhost:3001");
    }
    const badScope = await validateAuthorizeRequest(authParams("v".repeat(43), { scope: "admin" }), deps);
    expect(!badScope.ok && new URL(badScope.redirectTo).searchParams.get("error")).toBe("invalid_scope");
    const badResource = await validateAuthorizeRequest(authParams("v".repeat(43), { resource: "https://other.example/" }), deps);
    expect(!badResource.ok && new URL(badResource.redirectTo).searchParams.get("error")).toBe("invalid_target");
  });

  it("denies with access_denied", async () => {
    const { redirectTo } = await denyAuthorization(user, { params: authParams("v".repeat(43)) }, deps);
    expect(new URL(redirectTo).searchParams.get("error")).toBe("access_denied");
  });

  it("limits granted scopes to what the client requested", async () => {
    const { code, verifier } = await authorize({ params: { scope: "links:read" }, toolsets: ["links", "analytics"] });
    const res = await exchange(code, verifier);
    expect(res.status === 200 && res.body.scope).toBe("links:read");
  });
});

describe("token endpoint: authorization_code", () => {
  it("issues tokens bound to the grant and the resource", async () => {
    const { code, verifier, url } = await authorize({ toolsets: ["analytics"], confirmDestructive: false });
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("iss")).toBe("http://localhost:3001");
    const res = await exchange(code, verifier);
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.body).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "analytics:read" });
    expect(res.body.access_token).toMatch(/^lk_at_/);
    expect(res.body.refresh_token).toMatch(/^lk_rt_/);

    const p = await authenticateBearer(prisma, `Bearer ${res.body.access_token}`, "mcp");
    expect(p).toMatchObject({ userId: user.userId, source: "oauth", confirmDestructive: false, clientName: "Example Client" });
    await expect(authenticateBearer(prisma, `Bearer ${res.body.access_token}`, "api")).rejects.toThrow(/issued for/);
  });

  it("honors resource=/api/v1", async () => {
    const { code, verifier } = await authorize({ params: { resource: API } });
    const res = await exchange(code, verifier);
    if (res.status !== 200) throw new Error("expected tokens");
    await expect(authenticateBearer(prisma, `Bearer ${res.body.access_token}`, "api")).resolves.toBeTruthy();
    await expect(authenticateBearer(prisma, `Bearer ${res.body.access_token}`, "mcp")).rejects.toThrow(/issued for/);
  });

  it("fails PKCE verification with the wrong verifier", async () => {
    const { code } = await authorize();
    const res = await exchange(code, randomBytes(32).toString("base64url"));
    expect(res).toEqual({ status: 400, body: { error: "invalid_grant", error_description: "PKCE verification failed." } });
  });

  it("rejects a mismatched redirect_uri or client_id", async () => {
    const a = await authorize();
    expect((await exchange(a.code, a.verifier, { redirect_uri: "http://127.0.0.1:40002/callback" })).body).toMatchObject({ error: "invalid_grant" });
    const b = await authorize();
    expect((await exchange(b.code, b.verifier, { client_id: "https://other.example/meta.json" })).body).toMatchObject({ error: "invalid_grant" });
  });

  it("revokes the grant when a code is reused", async () => {
    const { code, verifier } = await authorize();
    const first = await exchange(code, verifier);
    if (first.status !== 200) throw new Error("expected tokens");
    const second = await exchange(code, verifier);
    expect(second.body).toMatchObject({ error: "invalid_grant" });
    await expect(authenticateBearer(prisma, `Bearer ${first.body.access_token}`, "mcp")).rejects.toThrow(/revoked/);
  });

  it("rejects expired codes", async () => {
    const { code, verifier } = await authorize();
    const res = await exchangeToken(
      { grant_type: "authorization_code", code, code_verifier: verifier, client_id: CLIENT_ID, redirect_uri: REDIRECT },
      { ...deps, now: () => new Date(Date.now() + 61_000) },
    );
    expect(res.body).toMatchObject({ error: "invalid_grant", error_description: "The authorization code has expired." });
  });

  it("reuses one grant per user and client, updating it on re-consent", async () => {
    const a = await authorize({ toolsets: ["links", "analytics"] });
    await exchange(a.code, a.verifier);
    const b = await authorize({ toolsets: ["analytics"], confirmDestructive: false });
    await exchange(b.code, b.verifier);
    const grants = await prisma.grant.findMany({ where: { userId: user.userId } });
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ scopes: ["analytics:read"], confirmDestructive: false });
  });

  it("rejects unsupported grant types", async () => {
    expect((await exchangeToken({ grant_type: "password" }, deps)).body).toMatchObject({ error: "unsupported_grant_type" });
  });
});

describe("token endpoint: refresh_token", () => {
  async function tokens() {
    const { code, verifier } = await authorize();
    const res = await exchange(code, verifier);
    if (res.status !== 200) throw new Error("expected tokens");
    return res.body;
  }
  const refresh = (refresh_token: string) => exchangeToken({ grant_type: "refresh_token", refresh_token, client_id: CLIENT_ID }, deps);

  it("rotates: each refresh token works once and returns a new one", async () => {
    const t1 = await tokens();
    const r1 = await refresh(t1.refresh_token);
    expect(r1.status).toBe(200);
    if (r1.status !== 200) return;
    expect(r1.body.refresh_token).not.toBe(t1.refresh_token);
    await expect(authenticateBearer(prisma, `Bearer ${r1.body.access_token}`, "mcp")).resolves.toBeTruthy();
    expect((await refresh(r1.body.refresh_token)).status).toBe(200);
  });

  it("detects reuse and revokes the whole grant", async () => {
    const t1 = await tokens();
    const r1 = await refresh(t1.refresh_token);
    if (r1.status !== 200) throw new Error("expected tokens");
    const reused = await refresh(t1.refresh_token);
    expect(reused.body).toMatchObject({ error: "invalid_grant" });
    await expect(authenticateBearer(prisma, `Bearer ${r1.body.access_token}`, "mcp")).rejects.toThrow(/revoked/);
    expect((await refresh(r1.body.refresh_token)).body).toMatchObject({ error: "invalid_grant" });
  });

  it("stops working after the grant is revoked through /oauth/revoke", async () => {
    const t1 = await tokens();
    await revokeToken(prisma, t1.refresh_token);
    expect((await refresh(t1.refresh_token)).body).toMatchObject({ error: "invalid_grant" });
    await expect(authenticateBearer(prisma, `Bearer ${t1.access_token}`, "mcp")).rejects.toThrow();
  });
});
