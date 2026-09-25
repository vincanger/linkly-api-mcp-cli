import { api, type Spec } from "@wasp.sh/spec";
import { restOpenApi } from "./handler" with { type: "ref" };

export const openapiSpec: Spec = [api("GET", "/api/v1/openapi.json", restOpenApi, { auth: false })];
