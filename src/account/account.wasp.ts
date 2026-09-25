import { api, type Spec } from "@wasp.sh/spec";
import { restMe } from "./rest" with { type: "ref" };

export const accountSpec: Spec = [
  // REST API (bearer auth handled in the handler, so Wasp's session auth is off)
  api("GET", "/api/v1/me", restMe, { auth: false }),
];
