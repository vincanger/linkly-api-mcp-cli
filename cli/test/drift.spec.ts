import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { SERVER_URL } from "../../e2e/env";

// The CLI's committed OpenAPI snapshot (and the types generated from it)
// must match what the server serves. Refresh with `npm run gen` in cli/.
test("cli/openapi.json matches the live /api/v1/openapi.json", async () => {
  const live = await (await fetch(`${SERVER_URL}/api/v1/openapi.json`)).json();
  const snapshot = JSON.parse(readFileSync("cli/openapi.json", "utf8"));
  expect(snapshot).toEqual(live);
});
