import { describe, expect, it } from "vitest";
import { apiCatalog } from "./apiCatalog";

describe("apiCatalog (RFC 9727)", () => {
  it("anchors on the REST API and points at the OpenAPI document and the docs", () => {
    const { linkset } = apiCatalog({ serverUrl: "https://api.linkly.example", frontendUrl: "https://linkly.example" });
    expect(linkset).toHaveLength(1);
    expect(linkset[0]!.anchor).toBe("https://api.linkly.example/api/v1");
    expect(linkset[0]!["service-desc"].map((l) => l.href)).toEqual(["https://api.linkly.example/api/v1/openapi.json"]);
    expect(linkset[0]!["service-doc"].map((l) => l.href)).toEqual([
      "https://linkly.example/docs/rest-api",
      "https://linkly.example/llms.txt",
    ]);
  });
});
