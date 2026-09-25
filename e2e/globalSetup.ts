import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { CLIENT_URL, SERVER_URL } from "./env";

// Playwright waits for the client (port 3000); also wait for the API server,
// then load the app once so Vite finishes optimizing dependencies before any
// test fills in a form (a dependency re-optimization reloads the page).
export default async function globalSetup() {
  // The CLI tests run the built binary.
  if (!existsSync("cli/node_modules")) execSync("npm ci", { cwd: "cli", stdio: "inherit" });
  execSync("npm run build", { cwd: "cli", stdio: "pipe" });

  const deadline = Date.now() + 180_000;
  for (;;) {
    try {
      await fetch(`${SERVER_URL}/`);
      break;
    } catch {
      if (Date.now() > deadline) throw new Error(`Server at ${SERVER_URL} did not start in time.`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const path of ["/", "/login", "/signup", "/links", "/links/new"]) {
    await page.goto(`${CLIENT_URL}${path}`);
    await page.waitForLoadState("networkidle");
  }
  await page.waitForTimeout(1500);
  await browser.close();
}
