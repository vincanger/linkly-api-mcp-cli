import { api, type Spec } from "@wasp.sh/spec";
import { OPENAPI_PATH, WELL_KNOWN_OPENAPI_PATH } from "../discovery/paths";
import { restOpenApi, wellKnownOpenApi } from "./handler" with { type: "ref" };

export const openapiSpec: Spec = [
  api("GET", OPENAPI_PATH, restOpenApi, { auth: false }),
  api("GET", WELL_KNOWN_OPENAPI_PATH, wellKnownOpenApi, { auth: false }),
];
