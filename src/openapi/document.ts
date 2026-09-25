// Assembles the OpenAPI 3.1 document from every slice's registrations.
// Framework-free so tests can validate it without a server.
import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { registerAccountOpenApi } from "../account/openapi";
import { registerAnalyticsOpenApi } from "../analytics/openapi";
import { registerLinksOpenApi } from "../links/openapi";
import { SCOPES } from "../shared/scopes";
import { apiResourceUrl, frontendUrl, serverUrl } from "../shared/urls";
import { registerCommon } from "./common";

export const SLICE_REGISTRATIONS: ((registry: OpenAPIRegistry) => void)[] = [
  registerAccountOpenApi,
  registerLinksOpenApi,
  registerAnalyticsOpenApi,
];

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registerCommon(registry);
  registry.registerComponent("securitySchemes", "bearer", {
    type: "http",
    scheme: "bearer",
    description: "A personal access token (lk_pat_…) from /settings/tokens, or an OAuth access token (lk_at_…).",
  });
  registry.registerComponent("securitySchemes", "oauth2", {
    type: "oauth2",
    description:
      "OAuth 2.1 authorization code with PKCE (S256). Clients identify themselves with a Client ID Metadata Document URL; no registration needed. Request `resource=" +
      apiResourceUrl() +
      "`.",
    flows: {
      authorizationCode: {
        authorizationUrl: `${frontendUrl()}/oauth/authorize`,
        tokenUrl: `${serverUrl()}/oauth/token`,
        refreshUrl: `${serverUrl()}/oauth/token`,
        scopes: { ...SCOPES },
      },
    },
  });
  for (const register of SLICE_REGISTRATIONS) register(registry);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Linkly API",
      version: "1.0.0",
      description:
        "Shorten links and read click analytics. Every operation declares `x-destructive`. The same operations are available as MCP tools at /mcp and as the `linkly` CLI.",
    },
    servers: [{ url: apiResourceUrl() }],
  });
}
