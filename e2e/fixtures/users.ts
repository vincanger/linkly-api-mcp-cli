import type { Page } from "@playwright/test";
import { SERVER_URL } from "../env";

export type TestUser = { userId: string; email: string; password: string };

/** Creates an already-verified user through the test-only API (no signup, no email). */
export async function createVerifiedUser(): Promise<TestUser> {
  const res = await fetch(`${SERVER_URL}/__test/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com` }),
  });
  if (!res.ok) throw new Error(`createVerifiedUser failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TestUser;
}

/** Logs in through the real login page. */
export async function logIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.getByRole("button", { name: "Log out" }).waitFor();
}
