// The RFC 9727 API catalog at /.well-known/api-catalog: a linkset (RFC 9264)
// pointing at the REST API's OpenAPI document and its docs.
import { dashboardPaths } from "../deeplinks/urls";
import { API_BASE_PATH, LLMS_TXT_PATH, OPENAPI_PATH } from "./paths";

export const API_CATALOG_CONTENT_TYPE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

export function apiCatalog({ serverUrl, frontendUrl }: { serverUrl: string; frontendUrl: string }) {
  return {
    linkset: [
      {
        anchor: serverUrl + API_BASE_PATH,
        "service-desc": [{ href: serverUrl + OPENAPI_PATH, type: "application/vnd.oai.openapi+json;version=3.1" }],
        "service-doc": [
          { href: frontendUrl + dashboardPaths.doc("rest-api"), type: "text/html" },
          { href: frontendUrl + LLMS_TXT_PATH, type: "text/markdown" },
        ],
      },
    ],
  };
}
