import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../test/db";
import { InvalidClientError, parseClientIdUrl, redirectUriMatches, resolveClient, validateMetadataDocument } from "./cimd";
import { fetchJsonGuarded, isAddressAllowed, isAllowedLoopbackClient, resolveAllowed, SsrfError } from "./ssrf";

const CLIENT_ID = "https://client.example.com/oauth/metadata.json";
const doc = (overrides: Record<string, unknown> = {}) => ({
  client_id: CLIENT_ID,
  client_name: "Example Client",
  redirect_uris: ["https://client.example.com/callback", "http://127.0.0.1:33418/callback"],
  ...overrides,
});

beforeEach(resetDb);

describe("client_id URL", () => {
  it("requires https with a path", () => {
    expect(parseClientIdUrl(CLIENT_ID).href).toBe(CLIENT_ID);
    expect(() => parseClientIdUrl("http://client.example.com/meta.json", "production")).toThrow(InvalidClientError);
    expect(() => parseClientIdUrl("https://client.example.com/", "production")).toThrow(/path/);
    expect(() => parseClientIdUrl("not a url")).toThrow(InvalidClientError);
  });

  it("accepts http://localhost only in development and test", () => {
    expect(parseClientIdUrl("http://localhost:4567/client.json", "test").hostname).toBe("localhost");
    expect(parseClientIdUrl("http://127.0.0.1:4567/client.json", "development").hostname).toBe("127.0.0.1");
    expect(() => parseClientIdUrl("http://localhost:4567/client.json", "production")).toThrow(InvalidClientError);
    expect(() => parseClientIdUrl("https://localhost/client.json", "production")).toThrow(InvalidClientError);
  });
});

describe("metadata document validation", () => {
  it("accepts a valid document and falls back to the hostname for the name", () => {
    expect(validateMetadataDocument(CLIENT_ID, doc())).toMatchObject({ clientName: "Example Client", clientHost: "client.example.com" });
    expect(validateMetadataDocument(CLIENT_ID, doc({ client_name: undefined })).clientName).toBe("client.example.com");
  });

  it("rejects a client_id mismatch", () => {
    expect(() => validateMetadataDocument(CLIENT_ID, doc({ client_id: "https://evil.example.com/meta.json" }))).toThrow(/doesn't match/);
  });

  it("requires a non-empty redirect_uris array", () => {
    expect(() => validateMetadataDocument(CLIENT_ID, doc({ redirect_uris: [] }))).toThrow(/redirect_uris/);
    expect(() => validateMetadataDocument(CLIENT_ID, doc({ redirect_uris: "https://x" }))).toThrow(/redirect_uris/);
  });
});

describe("redirect_uri matching", () => {
  const registered = doc().redirect_uris;

  it("requires an exact match for non-loopback redirects", () => {
    expect(redirectUriMatches("https://client.example.com/callback", registered)).toBe(true);
    expect(redirectUriMatches("https://client.example.com/callback/", registered)).toBe(false);
    expect(redirectUriMatches("https://evil.example.com/callback", registered)).toBe(false);
  });

  it("ignores the port for loopback redirects (RFC 8252)", () => {
    expect(redirectUriMatches("http://127.0.0.1:50123/callback", registered)).toBe(true);
    expect(redirectUriMatches("http://127.0.0.1:50123/other", registered)).toBe(false);
    expect(redirectUriMatches("http://localhost:50123/callback", registered)).toBe(false); // different host
    expect(redirectUriMatches("http://localhost:1/cb", ["http://localhost:9999/cb"])).toBe(true);
  });
});

describe("SSRF guards", () => {
  it("blocks private, loopback, link-local, and metadata addresses", () => {
    for (const ip of ["169.254.169.254", "10.0.0.5", "192.168.1.1", "172.16.0.1", "127.0.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:10.0.0.1", "100.64.0.1"]) {
      expect(isAddressAllowed(ip, false), ip).toBe(false);
    }
    expect(isAddressAllowed("93.184.216.34", false)).toBe(true);
    expect(isAddressAllowed("2606:4700::1111", false)).toBe(true);
  });

  it("allows loopback only under the local-dev exception, and never other private ranges", () => {
    expect(isAddressAllowed("127.0.0.1", true)).toBe(true);
    expect(isAddressAllowed("::1", true)).toBe(true);
    expect(isAddressAllowed("10.0.0.5", true)).toBe(false);
    expect(isAddressAllowed("169.254.169.254", true)).toBe(false);
  });

  it("applies the local-dev exception only to literal loopback hostnames in dev/test", () => {
    expect(isAllowedLoopbackClient(new URL("http://localhost:1234/c.json"), "test")).toBe(true);
    expect(isAllowedLoopbackClient(new URL("http://[::1]:1234/c.json"), "development")).toBe(true);
    expect(isAllowedLoopbackClient(new URL("http://localhost:1234/c.json"), "production")).toBe(false);
    expect(isAllowedLoopbackClient(new URL("http://evil.example/c.json"), "test")).toBe(false);
  });

  it("rejects hostnames that resolve to loopback, even in dev", async () => {
    const fakeLookup = async () => [{ address: "127.0.0.1", family: 4 }];
    await expect(resolveAllowed("rebind.evil.example", false, fakeLookup)).rejects.toThrow(SsrfError);
    // Even with loopback allowed for the literal-localhost exception, a public
    // hostname resolving to loopback never gets that exception (see resolveClient).
    expect(isAllowedLoopbackClient(new URL("http://rebind.evil.example/c.json"), "development")).toBe(false);
  });

  it("refuses to fetch http://169.254.169.254 and http://10.0.0.5", async () => {
    await expect(fetchJsonGuarded(new URL("http://169.254.169.254/latest/meta-data"))).rejects.toThrow(SsrfError);
    await expect(fetchJsonGuarded(new URL("http://10.0.0.5/client.json"), { allowLoopback: true })).rejects.toThrow(SsrfError);
  });
});

describe("resolveClient", () => {
  it("fetches, validates, and caches for 24 hours", async () => {
    let fetches = 0;
    const deps = { prisma, fetchDocument: async () => (fetches++, doc()) };
    await resolveClient(CLIENT_ID, deps);
    await resolveClient(CLIENT_ID, deps);
    expect(fetches).toBe(1);
    await resolveClient(CLIENT_ID, { ...deps, now: () => new Date(Date.now() + 25 * 3600_000) });
    expect(fetches).toBe(2);
  });

  it("rejects the metadata endpoint address before fetching, in any environment", async () => {
    for (const nodeEnv of ["test", "production"]) {
      await expect(resolveClient("http://169.254.169.254/latest/meta-data", { prisma, nodeEnv })).rejects.toThrow(InvalidClientError);
      await expect(resolveClient("http://10.0.0.5/client.json", { prisma, nodeEnv })).rejects.toThrow(InvalidClientError);
    }
    await expect(resolveClient("https://169.254.169.254/latest/meta-data", { prisma, nodeEnv: "production" })).rejects.toThrow(/private or reserved/);
  });
});
