// Pending actions: a destructive request from an app becomes a record the
// user confirms in the dashboard (/confirm/:actionId).
import type { PendingAction, PrismaClient } from "@prisma/client";
import { deleteLink, findOwnedLink } from "../links/service";
import { DomainError } from "../shared/errors";
import { requireScope, requireSession, type Principal } from "../shared/principal";
import { dashboardUrls } from "./urls";

export const PENDING_TTL_MS = 15 * 60 * 1000;

export type Deps = { prisma: PrismaClient; now?: () => Date };

type DeletionPayload = { linkId: string; slug: string; destinationUrl: string };

export type PendingActionStatus = "pending" | "expired" | "completed" | "cancelled";

export type PendingActionOut = {
  id: string;
  type: "delete_link";
  status: PendingActionStatus;
  link: DeletionPayload;
  requestedBy: string;
  expiresAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
};

function statusOf(a: PendingAction, now: Date): PendingActionStatus {
  if (a.completedAt) return "completed";
  if (a.cancelledAt) return "cancelled";
  if (a.expiresAt <= now) return "expired";
  return "pending";
}

function toOut(a: PendingAction, now: Date): PendingActionOut {
  return {
    id: a.id,
    type: "delete_link",
    status: statusOf(a, now),
    link: a.payload as DeletionPayload,
    requestedBy: a.requestedBy,
    expiresAt: a.expiresAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
    cancelledAt: a.cancelledAt?.toISOString() ?? null,
  };
}

export async function createPendingDeletion(
  p: Principal,
  input: { linkId: string },
  { prisma, now = () => new Date() }: Deps,
): Promise<{ actionId: string; confirmUrl: string; expiresAt: string }> {
  requireScope(p, "links:write");
  const link = await findOwnedLink(prisma, p.userId, input.linkId);
  const expiresAt = new Date(now().getTime() + PENDING_TTL_MS);
  const action = await prisma.pendingAction.create({
    data: {
      userId: p.userId,
      type: "delete_link",
      payload: { linkId: link.id, slug: link.slug, destinationUrl: link.destinationUrl } satisfies DeletionPayload,
      requestedBy: p.clientName ?? "api",
      expiresAt,
    },
  });
  return { actionId: action.id, confirmUrl: dashboardUrls.confirm(action.id), expiresAt: expiresAt.toISOString() };
}

/** Other users' actions are "not found", like links. */
async function findOwnAction(prisma: PrismaClient, p: Principal, actionId: string): Promise<PendingAction> {
  const action = await prisma.pendingAction.findFirst({ where: { id: actionId, userId: p.userId } });
  if (!action) throw new DomainError("not_found", "This confirmation link isn't valid for your account.");
  return action;
}

export async function getPendingAction(p: Principal, input: { actionId: string }, { prisma, now = () => new Date() }: Deps) {
  requireSession(p, "Viewing a confirmation");
  return toOut(await findOwnAction(prisma, p, input.actionId), now());
}

/** Only the same user, in a dashboard session, before expiry, once. */
export async function confirmPendingAction(
  p: Principal,
  input: { actionId: string },
  { prisma, now = () => new Date() }: Deps,
): Promise<PendingActionOut> {
  requireSession(p, "Confirming a deletion");
  const action = await findOwnAction(prisma, p, input.actionId);
  const status = statusOf(action, now());
  if (status !== "pending") throw new DomainError("conflict", `This request is ${status} and can't be confirmed.`);

  // Claim it first so a double click can't run it twice.
  const claimed = await prisma.pendingAction.updateMany({
    where: { id: action.id, completedAt: null, cancelledAt: null },
    data: { completedAt: now() },
  });
  if (claimed.count === 0) throw new DomainError("conflict", "This request was already handled.");

  const payload = action.payload as DeletionPayload;
  try {
    await deleteLink(p, { id: payload.linkId }, { prisma });
  } catch (e) {
    if (!(e instanceof DomainError && e.code === "not_found")) {
      await prisma.pendingAction.update({ where: { id: action.id }, data: { completedAt: null } });
      throw e;
    }
    // Already deleted some other way: the user's intent is satisfied.
  }
  return toOut((await prisma.pendingAction.findUnique({ where: { id: action.id } }))!, now());
}

export async function cancelPendingAction(
  p: Principal,
  input: { actionId: string },
  { prisma, now = () => new Date() }: Deps,
): Promise<PendingActionOut> {
  requireSession(p, "Cancelling a deletion");
  const action = await findOwnAction(prisma, p, input.actionId);
  const status = statusOf(action, now());
  if (status !== "pending") throw new DomainError("conflict", `This request is ${status} and can't be cancelled.`);
  const updated = await prisma.pendingAction.update({ where: { id: action.id }, data: { cancelledAt: now() } });
  return toOut(updated, now());
}
