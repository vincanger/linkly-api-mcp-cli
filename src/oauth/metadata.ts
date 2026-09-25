// RFC 9728 (protected resource) and RFC 8414 (authorization server) metadata.
import { ALL_SCOPES } from "../shared/scopes";
import { apiResourceUrl, frontendUrl, mcpResourceUrl, serverUrl } from "../shared/urls";

export function protectedResourceMetadata(target: "mcp" | "api") {
  return {
    resource: target === "mcp" ? mcpResourceUrl() : apiResourceUrl(),
    authorization_servers: [serverUrl()],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: target === "mcp" ? "Linkly MCP server" : "Linkly REST API",
    resource_documentation: `${frontendUrl()}/docs/${target === "mcp" ? "connecting-ai-clients" : "rest-api"}`,
  };
}

export function authorizationServerMetadata() {
  return {
    issuer: serverUrl(),
    // The authorization endpoint is a Wasp page, so it lives on the frontend origin.
    authorization_endpoint: `${frontendUrl()}/oauth/authorize`,
    token_endpoint: `${serverUrl()}/oauth/token`,
    revocation_endpoint: `${serverUrl()}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ALL_SCOPES,
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}
