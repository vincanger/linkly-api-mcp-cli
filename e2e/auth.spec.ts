import { expect, test } from "@playwright/test";

test("a new user can sign up, log out, and log back in", async ({ page }) => {
  const email = `signup-${Date.now()}@example.com`;
  const password = "correct-horse-battery-9";

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(/signed up successfully|check your email/i)).toBeVisible();

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
});
