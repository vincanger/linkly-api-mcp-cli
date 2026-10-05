import { defineConfig, devices } from "@playwright/test";
import { CLIENT_URL, TEST_DATABASE_URL } from "./e2e/env";

// Live-server tests: end-to-end browser flows, the MCP integration test, CLI
// tests, and OpenAPI checks all run against a real `wasp start` using the
// separate `linkly_test` database. `wasp start` sets NODE_ENV=development.
export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "cli/test/**/*.spec.ts"],
  testIgnore: ["**/node_modules/**"],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/globalSetup.ts",
  use: {
    baseURL: CLIENT_URL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    headless: true,
  },
  webServer: {
    command: "npx prisma migrate deploy --schema schema.prisma && wasp start < /dev/null",
    url: CLIENT_URL,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      LINKLY_ENABLE_TEST_API: "true",
      MCP_REQUEST_STATE_KEY: "test-only-request-state-key-0123456789abcdef",
    },
  },
});
