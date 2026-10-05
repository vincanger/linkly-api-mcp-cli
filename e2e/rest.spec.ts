import SwaggerParser from "@apidevtools/swagger-parser";
import { expect, test } from "@playwright/test";
import { SERVER_URL } from "./env";
import { apiClient } from "./fixtures/api";
import { createPatFor } from "./fixtures/db";
import { createVerifiedUser, gotoReady, logIn } from "./fixtures/users";

test("a PAT created on the tokens page can do full CRUD over REST", async ({ page }) => {
  const user = await createVerifiedUser();
  await logIn(page, user);
  await gotoReady(page, "/settings/tokens");
  await page.getByLabel("Name").fill("e2e");
  await page.getByRole("button", { name: "Create token" }).click();
  const token = (await page.getByTestId("new-token").textContent())!.trim();
  expect(token).toMatch(/^lk_pat_/);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("cell", { name: "e2e", exact: true })).toBeVisible();

  const api = apiClient(token);

  const me = await api("GET", "/me");
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({ userId: user.userId, username: user.username, source: "pat", confirmDestructive: false });

  const slug = `rest-${Date.now()}`;
  const created = await api("POST", "/links", { destinationUrl: "https://example.com/a", slug, tags: ["api"] });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ slug, shortUrl: `${SERVER_URL}/r/${slug}` });
  const id = created.body.id;

  expect((await api("POST", "/links", { destinationUrl: "https://example.com/b", slug })).status).toBe(409);
  expect((await api("POST", "/links", { destinationUrl: "nope" })).status).toBe(400);

  const list = await api("GET", "/links?tag=api&limit=10");
  expect(list.status).toBe(200);
  expect(list.body.data.map((l: { id: string }) => l.id)).toEqual([id]);
  expect(list.body.nextCursor).toBeNull();

  expect((await api("GET", `/links/${slug}`)).body.id).toBe(id);

  const patched = await api("PATCH", `/links/${id}`, { title: "Updated" });
  expect(patched.status).toBe(200);
  expect(patched.body.title).toBe("Updated");

  const stats = await api("GET", `/links/${id}/stats?range=7d`);
  expect(stats.status).toBe(200);
  expect(stats.body.series).toHaveLength(7);
  expect((await api("GET", "/analytics/top-links?range=30d")).status).toBe(200);

  expect((await api("PUT", `/links/${id}`, {})).status).toBe(405);

  const deleted = await api("DELETE", `/links/${id}`);
  expect(deleted.status).toBe(200);
  expect(deleted.body).toEqual({ status: "deleted", id, slug });
  expect((await api("GET", `/links/${id}`)).status).toBe(404);

  // Revoked on the tokens page → 401
  await gotoReady(page, "/settings/tokens");
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("button", { name: "Revoke token" }).click();
  await expect(page.getByText("No tokens yet.")).toBeVisible();
  expect((await api("GET", "/me")).status).toBe(401);
});

test("missing scope returns 403, missing token returns 401 with WWW-Authenticate", async () => {
  const user = await createVerifiedUser();
  const readOnly = apiClient(await createPatFor(user.userId, ["links:read"]));
  const denied = await readOnly("POST", "/links", { destinationUrl: "https://example.com" });
  expect(denied.status).toBe(403);
  expect(denied.body.error).toMatchObject({ code: "forbidden" });
  expect(denied.body.error.message).toContain("links:write");
  expect((await readOnly("GET", "/analytics/top-links")).status).toBe(403);

  const anonymous = await apiClient()("GET", "/links");
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("www-authenticate")).toBe(
    `Bearer resource_metadata="${SERVER_URL}/.well-known/oauth-protected-resource/api/v1"`,
  );
});

test("openapi.json is public and valid", async () => {
  const res = await fetch(`${SERVER_URL}/api/v1/openapi.json`);
  expect(res.status).toBe(200);
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
  const doc = await res.json();
  await SwaggerParser.validate(doc);
  expect(doc.servers[0].url).toBe(`${SERVER_URL}/api/v1`);
});
