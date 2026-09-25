import { expect, test } from "@playwright/test";
import { SERVER_URL } from "./env";
import { gotoReady } from "./fixtures/users";

test("docs are public over REST", async () => {
  const search = await (await fetch(`${SERVER_URL}/api/v1/docs/search?q=how%20are%20clicks%20counted`)).json();
  expect(search.results[0].slug).toBe("how-clicks-are-counted");
  const doc = await fetch(`${SERVER_URL}/api/v1/docs/rest-api`);
  expect(doc.status).toBe(200);
  expect((await doc.json()).markdown).toContain(`${SERVER_URL}/api/v1/openapi.json`);
  expect((await fetch(`${SERVER_URL}/api/v1/docs/nope`)).status).toBe(404);
});

test("the docs pages search and render Markdown", async ({ page }) => {
  await gotoReady(page, "/docs");
  await page.getByLabel("Search docs").fill("how are clicks counted");
  await page.getByRole("link", { name: /How clicks are counted/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "How clicks are counted" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Every redirect counts" })).toBeVisible();
  await gotoReady(page, "/docs/connecting-ai-clients");
  await expect(page.locator("pre code")).toHaveText(`${SERVER_URL}/mcp`);
});
