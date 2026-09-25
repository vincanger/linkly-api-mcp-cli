// Human-mode output (a TTY) and error formatting, with the server stubbed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "../cli/src/program";

function tty() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (s: string) => void out.push(s), stderr: (s: string) => void err.push(s), isTTY: true }, out, err };
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })));
}

const link = {
  id: "8b1c",
  slug: "launch",
  destinationUrl: "https://example.com/launch",
  title: "Launch",
  tags: ["promo"],
  archived: false,
  createdAt: "2026-09-25T00:00:00.000Z",
  updatedAt: "2026-09-25T00:00:00.000Z",
  shortUrl: "http://localhost:3001/r/launch",
  dashboardUrl: "http://localhost:3000/links/8b1c",
};
const argv = (...args: string[]) => ["node", "linkly", "--token", "lk_pat_x", ...args];

afterEach(() => vi.unstubAllGlobals());

describe("CLI human output", () => {
  it("prints a table for lists", async () => {
    stubFetch(200, { data: [link], nextCursor: "abc" });
    const { io, out } = tty();
    expect(await run(argv("links", "list"), io, async () => "")).toBe(0);
    expect(out.join("\n")).toMatch(/^SLUG\s+SHORT URL\s+DESTINATION\s+TAGS\nlaunch\s+http:\/\/localhost:3001\/r\/launch/);
    expect(out.join("\n")).toContain("More: linkly links list --cursor abc");
  });

  it("prints fields for one link, including the dashboard URL", async () => {
    stubFetch(200, link);
    const { io, out } = tty();
    await run(argv("links", "get", "launch"), io, async () => "");
    expect(out.join("\n")).toContain("Dashboard    http://localhost:3000/links/8b1c");
  });

  it("prints the confirmation link when the server asks for confirmation", async () => {
    stubFetch(202, { status: "confirmation_required", confirmUrl: "http://localhost:3000/confirm/1", actionId: "1", expiresAt: "x", message: "Deletion needs confirmation." });
    const { io, out } = tty();
    expect(await run(argv("links", "delete", "launch", "--yes"), io, async () => "")).toBe(0);
    expect(out.join("\n")).toBe("Deletion needs confirmation.\nConfirm here: http://localhost:3000/confirm/1");
  });

  it("writes errors to stderr as text on a TTY and maps the exit code", async () => {
    stubFetch(404, { error: { code: "not_found", message: 'Link "x" not found.' } });
    const { io, out, err } = tty();
    expect(await run(argv("links", "get", "x"), io, async () => "")).toBe(5);
    expect(out).toEqual([]);
    expect(err.join("")).toBe('Error: Link "x" not found.');
  });
});
