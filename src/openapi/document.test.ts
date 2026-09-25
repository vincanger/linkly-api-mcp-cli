import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./document";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

function operations(doc: ReturnType<typeof buildOpenApiDocument>) {
  return Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const op = (item as Record<string, Record<string, unknown> | undefined>)[method];
      return op ? [{ path, method, op }] : [];
    }),
  );
}

describe("OpenAPI document", () => {
  it("is a valid OpenAPI 3.1 document", async () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    await expect(SwaggerParser.validate(structuredClone(doc) as never)).resolves.toBeTruthy();
  });

  it("marks every operation with x-destructive, and only deleting a link is destructive", () => {
    const ops = operations(buildOpenApiDocument());
    expect(ops.length).toBeGreaterThan(0);
    for (const { op } of ops) expect(typeof op["x-destructive"]).toBe("boolean");
    expect(ops.filter(({ op }) => op["x-destructive"]).map(({ method, path }) => `${method} ${path}`)).toEqual([
      "delete /links/{id}",
    ]);
  });

  it("documents bearer and OAuth security with per-operation scopes", () => {
    const doc = buildOpenApiDocument();
    expect(Object.keys(doc.components?.securitySchemes ?? {})).toEqual(["bearer", "oauth2"]);
    const createLink = operations(doc).find((o) => o.op.operationId === "createLink");
    expect(createLink?.op.security).toEqual([{ bearer: [] }, { oauth2: ["links:write"] }]);
  });
});
