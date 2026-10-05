import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelPendingAction, confirmPendingAction, getPendingAction } from "../deeplinks/service";
import { createLink } from "../links/service";
import { principalFromGrant, principalFromSession, type Principal } from "../shared/principal";
import { createTestUser, prisma, resetDb } from "../test/db";
import { connectInProcess, type ConnectOptions } from "./testClient";

// Deletions over URL-mode elicitation (MCP 2026-07-28): the client opens the
// confirm page itself, and the retried call reports what the user decided.

const URL_MODE = { elicitation: { url: {} } };
const FAST = { waitMs: 300, pollMs: 10, maxWaits: 3 };

let owner: Principal;
let app: Principal;
let conns: Awaited<ReturnType<typeof connectInProcess>>[] = [];

beforeEach(async () => {
  await resetDb();
  owner = principalFromSession(await createTestUser());
  app = principalFromGrant({ id: "g1", userId: owner.userId, clientName: "Claude", scopes: ["links:read", "links:write"], confirmDestructive: true });
  await createLink(owner, { destinationUrl: "https://a.com", slug: "doomed" }, { prisma });
});
afterEach(async () => {
  vi.useRealTimers();
  for (const c of conns) await c.close();
  conns = [];
});

async function connect(opts: ConnectOptions, as: Principal = app) {
  const conn = await connectInProcess(as, { confirmations: FAST, ...opts });
  conns.push(conn);
  return conn;
}

type Decision = "accept" | "decline" | "cancel";

/** A client that can open URLs, whose "user" does `decide` with the confirm page's action ID. */
async function urlClient(decide: (actionId: string) => Decision | Promise<Decision>, opts: ConnectOptions = {}) {
  const prompts: { mode?: string; url?: string; message: string }[] = [];
  const conn = await connect({
    capabilities: URL_MODE,
    onElicit: async (params) => {
      const p = params as { mode?: string; url: string; message: string };
      prompts.push(p);
      return { action: await decide(p.url.split("/confirm/")[1]!) };
    },
    ...opts,
  });
  return { ...conn, prompts };
}

const linkExists = async () => (await prisma.link.count({ where: { slug: "doomed" } })) === 1;
const deleteDoomed = (c: { call: (n: string, a: Record<string, unknown>) => Promise<{ structuredContent?: unknown }> }) =>
  c.call("delete_link", { id: "doomed" }).then((r) => r.structuredContent as Record<string, unknown>);

describe("confirming a deletion with URL-mode elicitation", () => {
  it("opens the confirm page, and returns the result once the user confirms", async () => {
    const c = await urlClient(async (actionId): Promise<Decision> => {
      expect(await linkExists()).toBe(true); // nothing deleted before the user confirms
      await confirmPendingAction(owner, { actionId }, { prisma }); // the user confirms on the page
      return "accept";
    });
    expect(await deleteDoomed(c)).toEqual({
      status: "deleted",
      id: expect.any(String),
      slug: "doomed",
      actionId: expect.any(String),
      message: "The user confirmed the deletion in Linkly. The link is deleted.",
    });
    expect(c.prompts).toEqual([
      { mode: "url", url: expect.stringMatching(/^http:\/\/localhost:3000\/confirm\/[0-9a-f-]{36}$/), message: 'Confirm deleting the link "doomed" in Linkly.' },
    ]);
    expect(await linkExists()).toBe(false);
  });

  it("waits for the user without asking again", async () => {
    // "Accept" only means the page opened: the user confirms a moment later.
    let confirming: Promise<unknown> | undefined;
    const c = await urlClient((actionId) => {
      confirming = new Promise((resolve) => setTimeout(resolve, 50)).then(() => confirmPendingAction(owner, { actionId }, { prisma }));
      return "accept";
    });
    expect(await deleteDoomed(c)).toMatchObject({ status: "deleted", slug: "doomed" });
    await confirming;
    expect(c.prompts).toHaveLength(1);
  });

  it("falls back to the link when the user takes too long", async () => {
    const c = await urlClient(() => "accept");
    expect(await deleteDoomed(c)).toMatchObject({
      status: "confirmation_required",
      confirmUrl: expect.stringContaining("/confirm/"),
      message: expect.stringContaining("hasn't confirmed yet"),
    });
    expect(c.prompts).toHaveLength(1);
    expect(await linkExists()).toBe(true);
  });

  it("reports a cancel on the confirm page", async () => {
    const c = await urlClient(async (actionId): Promise<Decision> => {
      await cancelPendingAction(owner, { actionId }, { prisma });
      return "accept";
    });
    expect(await deleteDoomed(c)).toMatchObject({ status: "not_deleted", slug: "doomed", message: expect.stringContaining("cancelled the deletion") });
    expect(await linkExists()).toBe(true);
  });

  it("withdraws the request when the user declines to open the page", async () => {
    let actionId = "";
    const c = await urlClient((id) => ((actionId = id), "decline"));
    expect(await deleteDoomed(c)).toMatchObject({ status: "not_deleted", message: expect.stringContaining("declined") });
    expect((await getPendingAction(owner, { actionId }, { prisma })).status).toBe("cancelled"); // its link is dead
    expect(await linkExists()).toBe(true);
  });

  it("returns the link when the user dismisses the prompt", async () => {
    const c = await urlClient(() => "cancel");
    expect(await deleteDoomed(c)).toMatchObject({ status: "confirmation_required", confirmUrl: expect.stringContaining("/confirm/"), message: expect.stringContaining("dismissed") });
    expect(await linkExists()).toBe(true);
  });

  it("reports an expired confirmation", async () => {
    const later = () => new Date(Date.now() + 16 * 60_000);
    const c = await urlClient(() => "accept", { confirmations: { ...FAST, now: later } });
    expect(await deleteDoomed(c)).toMatchObject({ status: "not_deleted", message: expect.stringContaining("expired") });
    expect(await linkExists()).toBe(true);
  });
});

describe("clients that can't open URLs get the link", () => {
  const cases: [string, ConnectOptions][] = [
    ["no elicitation", { capabilities: {} }],
    ["form mode only", { capabilities: { elicitation: { form: {} } } }],
    // 2025-era clients declare capabilities once, at initialize; a stateless server never sees them on tools/call.
    ["2025-era client, even with URL mode", { era: "legacy", capabilities: URL_MODE }],
  ];
  it.each(cases)("%s", async (_name, opts) => {
    const onElicit = vi.fn(() => ({ action: "accept" as const }));
    const c = await connect({ ...opts, onElicit });
    expect(await deleteDoomed(c)).toMatchObject({ status: "confirmation_required", confirmUrl: expect.stringContaining("/confirm/") });
    expect(onElicit).not.toHaveBeenCalled();
    expect(await linkExists()).toBe(true);
  });
});

describe("requestState can't be forged or replayed", () => {
  type Raw = { resultType?: string; requestState?: string; isError?: boolean; content?: { text: string }[] };

  /** Starts a deletion without auto-retrying, and returns a function that retries it with any state. */
  async function started(as: Principal = app) {
    const { client } = await connect({ capabilities: URL_MODE, onElicit: () => ({ action: "accept" }) }, as);
    const send = (params: Record<string, unknown>) =>
      client.request({ method: "tools/call", params } as never, { allowInputRequired: true }) as Promise<Raw>;
    const first = await send({ name: "delete_link", arguments: { id: "doomed" } });
    expect(first).toMatchObject({ resultType: "input_required", requestState: expect.any(String) });
    return { state: first.requestState!, send };
  }
  const accepted = { confirm: { action: "accept" } };

  it("rejects state that was tampered with", async () => {
    const { state, send } = await started();
    await expect(send({ name: "delete_link", arguments: { id: "doomed" }, inputResponses: accepted, requestState: `${state}x` })).rejects.toThrow(
      /Invalid or expired requestState/,
    );
  });

  it("rejects state from another connection", async () => {
    const { state } = await started();
    const other = principalFromGrant({ ...app, id: "g2", scopes: ["links:read", "links:write"] } as never);
    const { client } = await connect({ capabilities: URL_MODE }, other);
    await expect(
      client.request({ method: "tools/call", params: { name: "delete_link", arguments: { id: "doomed" }, inputResponses: accepted, requestState: state } } as never, { allowInputRequired: true }),
    ).rejects.toThrow(/Invalid or expired requestState/);
  });

  it("rejects state past its expiry", async () => {
    const { state, send } = await started();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await expect(send({ name: "delete_link", arguments: { id: "doomed" }, inputResponses: accepted, requestState: state })).rejects.toThrow(
      /Invalid or expired requestState/,
    );
  });

  it("rejects state replayed on another tool", async () => {
    const { state, send } = await started();
    const res = await send({ name: "update_link", arguments: { id: "doomed", title: "x" }, inputResponses: accepted, requestState: state });
    expect(res.isError).toBe(true);
    expect(res.content?.[0]?.text).toMatch(/doesn't match the call/);
  });

  afterEach(async () => {
    expect(await linkExists()).toBe(true); // nothing was deleted
  });
});
