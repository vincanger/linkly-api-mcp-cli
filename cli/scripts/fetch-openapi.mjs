// Refreshes the committed OpenAPI snapshot from a running Linkly server.
// Usage: npm run gen            (uses LINKLY_URL or http://localhost:3001)
import { writeFileSync } from "node:fs";

const base = (process.env.LINKLY_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const res = await fetch(`${base}/api/v1/openapi.json`);
if (!res.ok) {
  console.error(`Couldn't fetch ${base}/api/v1/openapi.json: HTTP ${res.status}. Is the server running?`);
  process.exit(1);
}
writeFileSync(new URL("../openapi.json", import.meta.url), JSON.stringify(await res.json(), null, 2) + "\n");
console.log(`Wrote openapi.json from ${base}`);
