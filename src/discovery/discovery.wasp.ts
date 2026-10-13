import { api, type Spec } from "@wasp.sh/spec";
import { API_CATALOG_PATH } from "./paths";
import { wellKnownApiCatalog } from "./routes" with { type: "ref" };

// The rest of discovery is build output (llms.txt from vite.config.ts,
// prerendered pages from the routes' `prerender` option), plus
// /.well-known/openapi.json in the OpenAPI slice.
export const discoverySpec: Spec = [api("GET", API_CATALOG_PATH, wellKnownApiCatalog, { auth: false })];
