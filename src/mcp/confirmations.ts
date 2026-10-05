// URL-mode elicitation for confirmations (MCP 2026-07-28). When a tool returns
// `confirmation_required` and the client declares it can open URLs, the client
// opens the confirm page itself instead of the agent passing the link along,
// and the retried call returns what happened. Every other client gets the link
// in the tool result, as before.
//
// The confirm page and its rules don't change (dashboard session, same user,
// once). The client's "accept" only means the user agreed to open the page, so
// the outcome always comes from the pending action, never from the client.
import type { PrismaClient } from "@prisma/client";
import {
  CLIENT_CAPABILITIES_META_KEY,
  createRequestStateCodec,
  inputRequired,
  inputResponse,
  type ClientCapabilities,
  type InputRequiredResult,
  type ServerContext,
} from "@modelcontextprotocol/server";
import * as deeplinks from "../deeplinks/service";
import { DomainError } from "../shared/errors";
import type { Principal } from "../shared/principal";

/** What the client echoes back on each retry. Signed, not encrypted: no secrets in it. */
export type ConfirmationState = { actionId: string; tool: string; waits: number };

export type ConfirmationDeps = {
  prisma: PrismaClient;
  now?: () => Date;
  /** How long one retry waits for the user to decide before asking the client to retry again. */
  waitMs?: number;
  pollMs?: number;
  /**
   * Retries that wait before falling back to the link. Clients cap the rounds
   * of one call (10 in the official SDKs), and the first round is the prompt.
   */
  maxWaits?: number;
};

const DEFAULTS = { waitMs: 20_000, pollMs: 1_000, maxWaits: 8 };

/** The HMAC key for `requestState`. Every server instance needs the same one, since any instance may get the retry. */
export function requestStateKey(): string {
  const key = process.env.MCP_REQUEST_STATE_KEY;
  if (!key || Buffer.byteLength(key, "utf8") < 32) {
    throw new Error("MCP_REQUEST_STATE_KEY must be at least 32 bytes (generate one with `openssl rand -base64 32`).");
  }
  return key;
}

type ConfirmationRequired = { status: "confirmation_required"; actionId: string; confirmUrl: string };
type Action = Awaited<ReturnType<typeof deeplinks.getDeletionStatus>>;

const isConfirmationRequired = (r: unknown): r is ConfirmationRequired =>
  typeof r === "object" && r !== null && (r as { status?: unknown }).status === "confirmation_required";

/** Capabilities travel with every 2026-07-28 request; 2025-era requests carry none, so they get the link. */
function canOpenUrls(ctx: ServerContext): boolean {
  const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
  const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined;
  return capabilities?.elicitation?.url !== undefined;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

const linkResult = (a: Action, message: string) => ({
  status: "confirmation_required" as const,
  confirmUrl: a.confirmUrl,
  actionId: a.id,
  expiresAt: a.expiresAt,
  slug: a.link.slug,
  message,
});

const notDeleted = (a: Action, message: string) => ({ status: "not_deleted" as const, actionId: a.id, slug: a.link.slug, message });

/** Confirmations for one request's principal. The state is bound to that principal, so another grant can't replay it. */
export function confirmations(principal: Principal, deps: ConfirmationDeps) {
  const { waitMs, pollMs, maxWaits } = { ...DEFAULTS, ...deps };
  const codec = createRequestStateCodec<ConfirmationState>({
    key: requestStateKey(),
    ttlSeconds: deeplinks.PENDING_TTL_MS / 1000,
    bind: () => `${principal.userId}\0${principal.grantId ?? ""}`,
  });
  const status = (actionId: string) => deeplinks.getDeletionStatus(principal, { actionId }, deps);

  /** Polls until the user decides on the confirm page, the wait runs out, or the client goes away. */
  async function waitForDecision(action: Action, signal: AbortSignal): Promise<Action> {
    const until = Date.now() + waitMs;
    while (action.status === "pending" && Date.now() < until && !signal.aborted) {
      await sleep(pollMs, signal);
      action = await status(action.id);
    }
    return action;
  }

  return {
    /** For `ServerOptions.requestState.verify`: tampered, expired, or another principal's state never reaches a handler. */
    verify: codec.verify,

    /** First call: if the client can open URLs, ask it to open the confirm page instead of returning the link. */
    async offer(tool: string, result: unknown, ctx: ServerContext): Promise<unknown> {
      if (!isConfirmationRequired(result) || !canOpenUrls(ctx)) return result;
      const action = await status(result.actionId);
      return inputRequired({
        inputRequests: {
          confirm: inputRequired.elicitUrl({ url: result.confirmUrl, message: `Confirm deleting the link "${action.link.slug}" in Linkly.` }),
        },
        requestState: await codec.mint({ actionId: result.actionId, tool, waits: 0 }, ctx),
      });
    },

    /** A retry: report what the user decided. Returns undefined for a first call. */
    async resume(tool: string, ctx: ServerContext): Promise<unknown | InputRequiredResult> {
      const state = ctx.mcpReq.requestState<ConfirmationState>();
      if (!state) return undefined;
      if (state.tool !== tool) throw new DomainError("invalid", "This retry doesn't match the call that started it. Call the tool again.");

      const answer = inputResponse(ctx.mcpReq.inputResponses, "confirm");
      let action = await status(state.actionId);
      const declined = action.status === "pending" && answer.kind === "elicit" && answer.action === "decline";
      if (declined) {
        await deeplinks.withdrawPendingAction(principal, { actionId: action.id }, deps);
        action = await status(action.id);
      } else if (action.status === "pending" && answer.kind === "elicit" && answer.action === "cancel") {
        return linkResult(action, "The user dismissed the prompt, so nothing was deleted yet. Share confirmUrl with the user; the link is deleted when they confirm.");
      }

      action = await waitForDecision(action, ctx.mcpReq.signal);
      switch (action.status) {
        case "completed":
          // Same status as an immediate delete, so say the user confirmed: the agent never sees the page.
          return {
            status: "deleted",
            id: action.link.linkId,
            slug: action.link.slug,
            actionId: action.id,
            message: "The user confirmed the deletion in Linkly. The link is deleted.",
          };
        case "cancelled":
          return notDeleted(action, declined ? "The user declined to open the confirmation page. Nothing was deleted." : "The user cancelled the deletion in Linkly. Nothing was deleted.");
        case "expired":
          return notDeleted(action, "The confirmation expired before the user confirmed. Nothing was deleted.");
        case "pending":
          if (state.waits + 1 >= maxWaits) {
            return linkResult(action, "The user hasn't confirmed yet, so nothing was deleted. Share confirmUrl with the user; the link is deleted when they confirm.");
          }
          // State only: the client retries without asking the user again.
          return inputRequired({ requestState: await codec.mint({ ...state, waits: state.waits + 1 }, ctx) });
      }
    },
  };
}
