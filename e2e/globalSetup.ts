import { SERVER_URL } from "./env";

// Playwright waits for the client (port 3000); also wait for the API server.
export default async function globalSetup() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${SERVER_URL}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Server at ${SERVER_URL} did not start in time.`);
}
