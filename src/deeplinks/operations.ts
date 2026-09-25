import { prisma } from "wasp/server";
import type { CancelPendingAction, ConfirmPendingAction, GetPendingAction } from "wasp/server/operations";
import { runOperation } from "../shared/waspErrors";
import { sessionPrincipal } from "../shared/waspSession";
import * as deeplinks from "./service";

const deps = { prisma };

export const getPendingAction: GetPendingAction<{ actionId: string }, deeplinks.PendingActionOut> = (args, context) =>
  runOperation(() => deeplinks.getPendingAction(sessionPrincipal(context), args, deps));

export const confirmPendingAction: ConfirmPendingAction<{ actionId: string }, deeplinks.PendingActionOut> = (args, context) =>
  runOperation(() => deeplinks.confirmPendingAction(sessionPrincipal(context), args, deps));

export const cancelPendingAction: CancelPendingAction<{ actionId: string }, deeplinks.PendingActionOut> = (args, context) =>
  runOperation(() => deeplinks.cancelPendingAction(sessionPrincipal(context), args, deps));
