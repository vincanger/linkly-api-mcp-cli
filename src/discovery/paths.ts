// Where agents look for Linkly. Each path lives here once; NOTES.md records
// why these were picked.
//
// - `llms.txt` is a convention (https://llmstxt.org), served by the dashboard.
// - `/.well-known/api-catalog` is RFC 9727, the one registered well-known path
//   for API discovery. It lists the OpenAPI document.
// - `/.well-known/openapi.json` has no standard behind it. It's there for
//   agents that guess it, and serves the same document as OPENAPI_PATH.

/** On the dashboard's site. */
export const LLMS_TXT_PATH = "/llms.txt";

/** On the API server. */
export const MCP_PATH = "/mcp";
export const API_BASE_PATH = "/api/v1";
export const OPENAPI_PATH = "/api/v1/openapi.json";
export const WELL_KNOWN_OPENAPI_PATH = "/.well-known/openapi.json";
export const API_CATALOG_PATH = "/.well-known/api-catalog";
