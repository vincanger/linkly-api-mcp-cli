// Wasp adapters for the discovery endpoints on the API server.
import type { WellKnownApiCatalog } from "wasp/server/api";
import { publicHandler } from "../shared/http";
import { frontendUrl, serverUrl } from "../shared/urls";
import { API_CATALOG_CONTENT_TYPE, apiCatalog } from "./apiCatalog";

export const wellKnownApiCatalog: WellKnownApiCatalog = publicHandler((_req, res) => {
  res.type(API_CATALOG_CONTENT_TYPE).send(JSON.stringify(apiCatalog({ serverUrl: serverUrl(), frontendUrl: frontendUrl() })));
});

