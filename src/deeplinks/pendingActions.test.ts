import { beforeEach, describe, expect, it } from "vitest";
import { createLink, requestDeletion } from "../links/service";
import { DomainError } from "../shared/errors";
import { principalFromGrant, principalFromSession, type Principal } from "../shared/principal";
import { createTestUser, prisma, resetDb } from "../test/db";
import { cancelPendingAction, confirmPendingAction, getDeletionStatus, getPendingAction, withdrawPendingAction } from "./pendingActions";

let owner: Principal;
let app: Principal;

beforeEach(async () => {
  await resetDb();
  owner = principalFromSession(await createTestUser());
  app = principalFromGrant({ id: "g", userId: owner.userId, clientName: "Claude", scopes: ["links:read", "links:write"], confirmDestructive: true });
});

async function pendingDeletion(slug = "doomed") {
  await createLink(owner, { destinationUrl: "https://a.com", slug }, { prisma });
  const res = await requestDeletion(app, { id: slug }, { prisma });
  if (res.status !== "confirmation_required") throw new Error("expected a pending deletion");
  return res;
}

const code = (e: unknown) => (e instanceof DomainError ? e.code : String(e));

describe("pending deletions", () => {
  it("deletes the link when the same user confirms", async () => {
    const { actionId, confirmUrl } = await pendingDeletion();
    expect(confirmUrl).toBe(`http://localhost:3000/confirm/${actionId}`);
    expect(await getPendingAction(owner, { actionId }, { prisma })).toMatchObject({ status: "pending", requestedBy: "Claude", link: { slug: "doomed" } });
    const done = await confirmPendingAction(owner, { actionId }, { prisma });
    expect(done.status).toBe("completed");
    expect(await prisma.link.count()).toBe(0);
  });

  it("fails gracefully for a different user", async () => {
    const { actionId } = await pendingDeletion();
    const stranger = principalFromSession(await createTestUser());
    await expect(confirmPendingAction(stranger, { actionId }, { prisma }).catch(code)).resolves.toBe("not_found");
    expect(await prisma.link.count()).toBe(1);
  });

  it("fails gracefully after expiry", async () => {
    const { actionId } = await pendingDeletion();
    const later = () => new Date(Date.now() + 16 * 60_000);
    expect((await getPendingAction(owner, { actionId }, { prisma, now: later })).status).toBe("expired");
    await expect(confirmPendingAction(owner, { actionId }, { prisma, now: later }).catch(code)).resolves.toBe("conflict");
    expect(await prisma.link.count()).toBe(1);
  });

  it("fails gracefully when confirmed twice", async () => {
    const { actionId } = await pendingDeletion();
    await confirmPendingAction(owner, { actionId }, { prisma });
    await expect(confirmPendingAction(owner, { actionId }, { prisma }).catch(code)).resolves.toBe("conflict");
  });

  it("can be cancelled, and then not confirmed", async () => {
    const { actionId } = await pendingDeletion();
    expect((await cancelPendingAction(owner, { actionId }, { prisma })).status).toBe("cancelled");
    await expect(confirmPendingAction(owner, { actionId }, { prisma }).catch(code)).resolves.toBe("conflict");
    expect(await prisma.link.count()).toBe(1);
  });

  it("can only be confirmed from a dashboard session", async () => {
    const { actionId } = await pendingDeletion();
    await expect(confirmPendingAction(app, { actionId }, { prisma }).catch(code)).resolves.toBe("forbidden");
  });

  it("lets the app that asked check its status, without a session", async () => {
    const { actionId, confirmUrl } = await pendingDeletion();
    expect(await getDeletionStatus(app, { actionId }, { prisma })).toMatchObject({ status: "pending", confirmUrl, link: { slug: "doomed" } });
    await confirmPendingAction(owner, { actionId }, { prisma });
    expect((await getDeletionStatus(app, { actionId }, { prisma })).status).toBe("completed");
    const stranger = principalFromGrant({ id: "g2", userId: (await createTestUser()).id, clientName: "Other", scopes: ["links:write"], confirmDestructive: true });
    await expect(getDeletionStatus(stranger, { actionId }, { prisma }).catch(code)).resolves.toBe("not_found");
  });

  it("lets the app withdraw a pending request, so its link can't be used", async () => {
    const { actionId } = await pendingDeletion();
    expect((await withdrawPendingAction(app, { actionId }, { prisma })).status).toBe("cancelled");
    await expect(confirmPendingAction(owner, { actionId }, { prisma }).catch(code)).resolves.toBe("conflict");
    expect(await prisma.link.count()).toBe(1);
  });

  it("leaves a confirmed request alone when withdrawn", async () => {
    const { actionId } = await pendingDeletion();
    await confirmPendingAction(owner, { actionId }, { prisma });
    expect((await withdrawPendingAction(app, { actionId }, { prisma })).status).toBe("completed");
  });

  it("deletes immediately when the grant doesn't require confirmation", async () => {
    await createLink(owner, { destinationUrl: "https://a.com", slug: "quick" }, { prisma });
    const noConfirm = { ...app, confirmDestructive: false };
    expect(await requestDeletion(noConfirm, { id: "quick" }, { prisma })).toMatchObject({ status: "deleted", slug: "quick" });
  });
});
