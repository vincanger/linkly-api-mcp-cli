import { defineConfig } from "vitest/config";

// Build checks, run with `npm run test:build`. They run `wasp build` and a
// client build, which write to .wasp/out: don't run them while `wasp start`
// (or the Playwright tests) are running.
export default defineConfig({
  test: {
    include: ["tests/build/**/*.check.ts"],
    environment: "node",
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
