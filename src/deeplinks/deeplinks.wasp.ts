import { action, page, query, route, type Spec } from "@wasp.sh/spec";
import { cancelPendingAction, confirmPendingAction, getPendingAction } from "./operations" with { type: "ref" };
import { ConfirmActionPage } from "./ui/ConfirmActionPage" with { type: "ref" };

export const deeplinksSpec: Spec = [
  // Not authRequired: the page sends logged-out users to /login and brings them back.
  route("ConfirmRoute", "/confirm/:actionId", page(ConfirmActionPage)),
  query(getPendingAction, { entities: ["PendingAction"] }),
  action(confirmPendingAction, { entities: ["PendingAction", "Link"] }),
  action(cancelPendingAction, { entities: ["PendingAction"] }),
];
