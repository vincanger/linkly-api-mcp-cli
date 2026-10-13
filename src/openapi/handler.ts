import type { RestOpenApi, WellKnownOpenApi } from "wasp/server/api";
import { publicHandler } from "../shared/http";
import { buildOpenApiDocument } from "./document";

export const restOpenApi: RestOpenApi = publicHandler((_req, res) => {
  res.json(buildOpenApiDocument());
});

// The same handler, also served at /.well-known/openapi.json for agents that
// look there first. A Wasp api is named after its import, so it gets a second name.
export const wellKnownOpenApi: WellKnownOpenApi = restOpenApi;
