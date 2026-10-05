// The deeplinks slice's service surface: pending actions and dashboard URLs.
export {
  cancelPendingAction,
  confirmPendingAction,
  createPendingDeletion,
  getDeletionStatus,
  getPendingAction,
  PENDING_TTL_MS,
  withdrawPendingAction,
} from "./pendingActions";
export type { PendingActionOut, PendingActionStatus } from "./pendingActions";
export { dashboardUrls } from "./urls";
