import type { Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { CLIENT_URL, SERVER_URL } from "../env";
import type { TestUser } from "./users";

export type Callback = { code: string | null; state: string | null; error: string | null; iss: string | null };

/**
 * A stand-in OAuth client on a random localhost port. It serves its Client ID
 * Metadata Document at http://localhost:<port>/client.json and records what
 * arrives at http://127.0.0.1:<port>/callback.
 */
export async function startTestClient(name = "Test Client") {
  const callbacks: Callback[] = [];
  let port = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname === "/client.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ client_id: clientId(), client_name: name, redirect_uris: [redirectUri()] }));
      return;
    }
    if (url.pathname === "/callback") {
      const p = url.searchParams;
      callbacks.push({ code: p.get("code"), state: p.get("state"), error: p.get("error"), iss: p.get("iss") });
      res.setHeader("Content-Type", "text/html");
      res.end("<!doctype html><title>Done</title><p>Authorization finished. You can close this tab.</p>");
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  // Dual-stack, so both http://localhost (may resolve to ::1) and 127.0.0.1 reach it.
  await new Promise<void>((resolve) => server.listen({ port: 0, host: "::", ipv6Only: false }, resolve));
  port = (server.address() as AddressInfo).port;
  const clientId = () => `http://localhost:${port}/client.json`;
  const redirectUri = () => `http://127.0.0.1:${port}/callback`;

  return {
    clientId: clientId(),
    redirectUri: redirectUri(),
    callbacks,
    lastCallback: () => callbacks[callbacks.length - 1],
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export type TestClient = Awaited<ReturnType<typeof startTestClient>>;

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authorizeUrl(client: TestClient, challenge: string, extra: Record<string, string> = {}): string {
  const url = new URL(`${CLIENT_URL}/oauth/authorize`);
  const params = {
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: randomBytes(8).toString("hex"),
    ...extra,
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Drives the consent screen in the browser. Logs in first if the page asks. */
export async function consent(
  page: Page,
  user: TestUser,
  authUrl: string,
  opts: { uncheck?: string[]; confirmDestructive?: boolean; deny?: boolean } = {},
): Promise<void> {
  await page.goto(authUrl);
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/login") {
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();
  }
  await page.getByTestId("client-name").waitFor();
  for (const label of opts.uncheck ?? []) await page.getByLabel(label, { exact: true }).uncheck();
  if (opts.confirmDestructive === false) await page.getByLabel("Require confirmation for destructive actions").uncheck();
  await page.getByRole("button", { name: opts.deny ? "Deny" : "Allow" }).click();
  await page.waitForURL(/127\.0\.0\.1:\d+\/callback/);
}

export async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${SERVER_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}
