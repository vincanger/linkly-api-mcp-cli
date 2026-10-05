import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";
import { SERVER_URL } from "../../e2e/env";
import { apiClient } from "../../e2e/fixtures/api";
import { createPatFor } from "../../e2e/fixtures/db";
import { createVerifiedUser } from "../../e2e/fixtures/users";
import { CLI, runCli, tempConfigDir } from "./run";

const ALL = ["links:read", "links:write", "analytics:read"];

test("full link CRUD, stats, and docs through the CLI", async () => {
  const user = await createVerifiedUser();
  const token = await createPatFor(user.userId, ALL);
  const env = { LINKLY_TOKEN: token, LINKLY_CONFIG_DIR: tempConfigDir() };
  const slug = `cli-${Date.now()}`;

  const who = await runCli(["whoami"], { env });
  expect(who.code).toBe(0);
  expect(who.json()).toMatchObject({ userId: user.userId, username: user.username, source: "pat" }); // piped → JSON by default

  const created = await runCli(["links", "create", "https://example.com/cli", "--slug", slug, "--tag", "cli", "--tag", "demo", "--json"], { env });
  expect(created.code).toBe(0);
  expect(created.json()).toMatchObject({ slug, tags: ["cli", "demo"], shortUrl: `${SERVER_URL}/r/${slug}` });

  // --json prints exactly the REST response body.
  const list = await runCli(["links", "list", "--tag", "cli", "--json"], { env });
  const rest = await apiClient(token)("GET", "/links?tag=cli");
  expect(list.json()).toEqual(rest.body);

  expect((await runCli(["links", "get", slug], { env })).json().id).toBe(created.json().id);

  const updated = await runCli(["links", "update", slug, "--destination", "https://example.com/v2", "--title", "Two"], { env });
  expect(updated.code).toBe(0);
  expect(updated.json()).toMatchObject({ destinationUrl: "https://example.com/v2", title: "Two" });

  await fetch(`${SERVER_URL}/r/${slug}`, { redirect: "manual" });
  const stats = await runCli(["stats", slug, "--range", "30d"], { env });
  expect(stats.json()).toMatchObject({ range: "30d", groupBy: "day" });
  expect(stats.json().series).toHaveLength(30);
  expect((await runCli(["top-links"], { env })).code).toBe(0);

  const docs = await runCli(["docs", "search", "how", "are", "clicks", "counted"], { env });
  expect(docs.json().results[0].slug).toBe("how-clicks-are-counted");

  const deleted = await runCli(["links", "delete", slug, "--yes"], { env });
  expect(deleted.code).toBe(0);
  expect(deleted.json()).toMatchObject({ status: "deleted", slug });
});

test("rules for agents: --yes, exit codes, stderr, no prompts", async () => {
  const user = await createVerifiedUser();
  const token = await createPatFor(user.userId, ALL);
  const env = { LINKLY_TOKEN: token, LINKLY_CONFIG_DIR: tempConfigDir() };
  await runCli(["links", "create", "https://example.com", "--slug", `keep-${user.userId.slice(0, 8)}`], { env });
  const slug = `keep-${user.userId.slice(0, 8)}`;

  // Destructive commands need --yes: exit 2 with the exact message, nothing deleted.
  const refused = await runCli(["links", "delete", slug], { env });
  expect(refused.code).toBe(2);
  expect(refused.stdout).toBe("");
  expect(JSON.parse(refused.stderr).error.message).toBe(`Refusing to delete without --yes. Re-run: linkly links delete ${slug} --yes`);
  expect((await runCli(["links", "get", slug], { env })).code).toBe(0);

  // Exit codes by error type.
  expect((await runCli(["links", "get", "does-not-exist"], { env })).code).toBe(5);
  expect((await runCli(["links", "create", "https://example.com", "--slug", slug], { env })).code).toBe(6);
  const badToken = await runCli(["whoami"], { env: { ...env, LINKLY_TOKEN: "lk_pat_nope" } });
  expect(badToken.code).toBe(3);
  expect(JSON.parse(badToken.stderr).error.code).toBe("unauthorized");
  const readOnly = await createPatFor(user.userId, ["links:read"]);
  expect((await runCli(["links", "create", "https://example.com"], { env: { ...env, LINKLY_TOKEN: readOnly } })).code).toBe(4);
  expect((await runCli(["links", "get"], { env })).code).toBe(2); // missing argument
  expect((await runCli(["stats", slug, "--range", "1y"], { env })).code).toBe(2); // invalid choice
  expect((await runCli(["whoami"], { env: { LINKLY_CONFIG_DIR: tempConfigDir() } })).code).toBe(3); // no token at all

  // Human output on a TTY isn't testable here; --help works and shows examples.
  const help = await runCli(["links", "create", "--help"]);
  expect(help.code).toBe(0);
  expect(help.stdout).toContain("Examples:");
  expect(help.stdout).toContain("linkly links create https://example.com/sale");

  // Every command above ran with stdin open and unwritten; none waited for input.
});

test("auth login verifies and saves the token (0600); no token means a usage error, not a prompt", async () => {
  const user = await createVerifiedUser();
  const token = await createPatFor(user.userId, ALL);
  const dir = tempConfigDir();

  const missing = await runCli(["auth", "login"], { env: { LINKLY_CONFIG_DIR: dir } });
  expect(missing.code).toBe(2);
  expect(missing.stderr).toContain("/settings/tokens");

  expect((await runCli(["auth", "login", "--token", "lk_pat_wrong"], { env: { LINKLY_CONFIG_DIR: dir } })).code).toBe(3);

  const login = await runCli(["auth", "login", "--token-stdin"], { env: { LINKLY_CONFIG_DIR: dir }, stdin: `${token}\n` });
  expect(login.code).toBe(0);
  const configFile = join(dir, "config.json");
  expect(statSync(configFile).mode & 0o777).toBe(0o600);

  const who = await runCli(["whoami"], { env: { LINKLY_CONFIG_DIR: dir } });
  expect(who.json().userId).toBe(user.userId);

  expect((await runCli(["auth", "logout"], { env: { LINKLY_CONFIG_DIR: dir } })).json()).toMatchObject({ removed: true });
  expect((await runCli(["whoami"], { env: { LINKLY_CONFIG_DIR: dir } })).code).toBe(3);
});

test("linkly links list --json | jq works", async () => {
  const user = await createVerifiedUser();
  const token = await createPatFor(user.userId, ALL);
  const env = { ...process.env, LINKLY_URL: SERVER_URL, LINKLY_TOKEN: token, LINKLY_CONFIG_DIR: tempConfigDir() };
  execSync(`node ${CLI} links create https://example.com/jq --slug jq-${Date.now()}`, { env, stdio: ["ignore", "ignore", "inherit"] });
  const out = execSync(`node ${CLI} links list --json | jq -r '.data[].destinationUrl'`, { env, stdio: ["ignore", "pipe", "inherit"] }).toString();
  expect(out.trim()).toBe("https://example.com/jq");
});
