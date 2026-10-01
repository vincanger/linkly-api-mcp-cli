import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { principalFromGrant, principalFromPat, principalFromSession, requireScope, requireSession } from "./principal";
import { ALL_SCOPES, capScopes, toggleScope, toolsetsForScopes } from "./scopes";

describe("principals", () => {
  it("gives dashboard sessions every scope and no confirmation step", () => {
    const p = principalFromSession({ id: "u1" });
    expect([...p.scopes].sort()).toEqual([...ALL_SCOPES].sort());
    expect(p.confirmDestructive).toBe(false);
    expect(p.source).toBe("session");
  });

  it("never asks PATs to confirm", () => {
    const p = principalFromPat({ userId: "u1", scopes: ["links:read"] });
    expect(p.confirmDestructive).toBe(false);
    expect(p.source).toBe("pat");
  });

  it("takes OAuth permissions from the grant", () => {
    const p = principalFromGrant({
      id: "g1",
      userId: "u1",
      clientName: "Test",
      scopes: ["analytics:read"],
      confirmDestructive: true,
    });
    expect([...p.scopes]).toEqual(["analytics:read"]);
    expect(p.confirmDestructive).toBe(true);
    expect(p.grantId).toBe("g1");
  });
});

describe("requireScope", () => {
  it("passes when the scope is present", () => {
    expect(() => requireScope(principalFromSession({ id: "u1" }), "links:write")).not.toThrow();
  });

  it("throws forbidden naming the missing scope", () => {
    const p = principalFromPat({ userId: "u1", scopes: ["links:read"] });
    try {
      requireScope(p, "links:write");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("forbidden");
      expect((e as DomainError).message).toContain("links:write");
    }
  });
});

describe("requireSession", () => {
  it("rejects tokens", () => {
    expect(() => requireSession(principalFromPat({ userId: "u", scopes: [] }), "Creating tokens")).toThrow(DomainError);
  });
});

describe("toolsets", () => {
  it("counts a toolset only when all of its scopes are granted", () => {
    expect(toolsetsForScopes(["links:read", "links:write"])).toEqual(["links"]);
    expect(toolsetsForScopes(["links:read"])).toEqual([]);
  });
});

describe("picking scopes", () => {
  it("caps the choice at what the app asked for", () => {
    expect(capScopes(["links:write", "links:read", "analytics:read", "nope"], ["links:read", "links:write"])).toEqual(["links:read", "links:write"]);
    expect(capScopes(["links:read"], [])).toEqual([]);
  });

  it("ticks read with write, and unticks write with read", () => {
    expect(toggleScope(["analytics:read"], "links:write", true)).toEqual(["links:read", "links:write", "analytics:read"]);
    expect(toggleScope(["links:read", "links:write"], "links:read", false)).toEqual([]);
    expect(toggleScope(["links:read", "links:write"], "links:write", false)).toEqual(["links:read"]);
    expect(toggleScope([], "analytics:read", true)).toEqual(["analytics:read"]);
  });
});
