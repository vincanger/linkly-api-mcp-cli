import type { RestOpenApi } from "wasp/server/api";
import { publicHandler } from "../shared/http";
import { buildOpenApiDocument } from "./document";

export const restOpenApi: RestOpenApi = publicHandler((_req, res) => {
  res.json(buildOpenApiDocument());
});
