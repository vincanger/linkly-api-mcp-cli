import { beforeEach, describe, expect, it } from "vitest";
import { authenticateBearer } from "../shared/bearer";
import { DomainError } from "../shared/errors";
import { principalFromPat, principalFromSession, type Principal } from "../shared/principal";
import { createTestUser, prisma, resetDb } from "../test/db";
import { createPat, listPats, revokePat } from "./service";

const deps = { prisma };
let alice: Principal;

beforeEach(async () => {
  await resetDb();
  alice = principalFromSession(await createTestUser());
});

describe("personal access tokens", () => {
  it("returns the raw token once and stores only its hash", async () => {
    const { token, pat } = await createPat(alice, { name: "CLI", scopes: ["links:read"] }, deps);
    expect(token).toMatch(/^lk_pat_[A-Za-z0-9_-]{43}$/);
    const row = await prisma.accessToken.findUniqueOrThrow({ where: { id: pat.id } });
    expect(row.tokenHash).not.toContain(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await listPats(alice, deps)).toHaveLength(1);
  });

  it("can't be created with a PAT (PATs can't mint PATs)", async () => {
    const viaPat = principalFromPat({ userId: alice.userId, scopes: ["links:read", "links:write"] });
    await expect(createPat(viaPat, { name: "x", scopes: ["links:read"] }, deps)).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === "forbidden",
    );
  });

  it("authenticates on both /api/v1 and /mcp until revoked", async () => {
    const { token, pat } = await createPat(alice, { name: "CLI", scopes: ["links:read"] }, deps);
    for (const target of ["api", "mcp"] as const) {
      const p = await authenticateBearer(prisma, `Bearer ${token}`, target);
      expect(p).toMatchObject({ userId: alice.userId, source: "pat", confirmDestructive: false });
      expect([...p.scopes]).toEqual(["links:read"]);
    }
    await revokePat(alice, { id: pat.id }, deps);
    await expect(authenticateBearer(prisma, `Bearer ${token}`, "api")).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === "unauthorized",
    );
    expect(await listPats(alice, deps)).toHaveLength(0);
  });

  it("expires", async () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const { token } = await createPat(alice, { name: "short", scopes: ["links:read"], expiresInDays: 1 }, { prisma, now: () => created });
    await expect(authenticateBearer(prisma, `Bearer ${token}`, "api", new Date("2026-01-01T12:00:00Z"))).resolves.toBeTruthy();
    await expect(authenticateBearer(prisma, `Bearer ${token}`, "api", new Date("2026-01-03T00:00:00Z"))).rejects.toThrow(/expired/);
  });

  it("won't revoke another user's token", async () => {
    const { pat } = await createPat(alice, { name: "mine", scopes: ["links:read"] }, deps);
    const bob = principalFromSession(await createTestUser());
    await expect(revokePat(bob, { id: pat.id }, deps)).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === "not_found",
    );
  });
});

describe("authenticateBearer", () => {
  it("rejects missing, malformed, and unknown tokens", async () => {
    for (const header of [undefined, "", "Basic abc", "Bearer lk_pat_nope"]) {
      await expect(authenticateBearer(prisma, header, "api")).rejects.toSatisfy(
        (e: unknown) => e instanceof DomainError && e.code === "unauthorized",
      );
    }
  });

  it("checks the OAuth audience and takes permissions from the grant", async () => {
    const grant = await prisma.grant.create({
      data: { userId: alice.userId, clientId: "https://client.example/app.json", clientName: "Test App", scopes: ["analytics:read"], confirmDestructive: true },
    });
    const { sha256Hex } = await import("../shared/crypto");
    const raw = "lk_at_test-token";
    await prisma.accessToken.create({
      data: { tokenHash: sha256Hex(raw), kind: "oauth", userId: alice.userId, grantId: grant.id, scopes: ["links:read", "analytics:read"], audience: "http://localhost:3001/mcp", expiresAt: new Date(Date.now() + 3600_000) },
    });

    const p = await authenticateBearer(prisma, `Bearer ${raw}`, "mcp");
    expect([...p.scopes]).toEqual(["analytics:read"]); // grant wins over the token's issued scopes
    expect(p).toMatchObject({ source: "oauth", grantId: grant.id, confirmDestructive: true, clientName: "Test App" });

    await expect(authenticateBearer(prisma, `Bearer ${raw}`, "api")).rejects.toThrow(/issued for/);

    await prisma.grant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    await expect(authenticateBearer(prisma, `Bearer ${raw}`, "mcp")).rejects.toThrow(/revoked/);
  });

  it("records lastUsedAt, throttled to once a minute", async () => {
    const { token, pat } = await createPat(alice, { name: "CLI", scopes: ["links:read"] }, deps);
    const t0 = new Date("2026-05-01T00:00:00Z");
    await authenticateBearer(prisma, `Bearer ${token}`, "api", t0);
    await new Promise((r) => setTimeout(r, 50));
    await authenticateBearer(prisma, `Bearer ${token}`, "api", new Date(t0.getTime() + 10_000));
    await new Promise((r) => setTimeout(r, 50));
    const row = await prisma.accessToken.findUniqueOrThrow({ where: { id: pat.id } });
    expect(row.lastUsedAt?.toISOString()).toBe(t0.toISOString());
  });
});
