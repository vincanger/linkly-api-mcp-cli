import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DOCS } from "../../src/docs/content";

// M10 build check: a client build with a given REACT_APP_API_URL writes
// llms.txt with that address, and real HTML for the homepage and every doc.
const API_URL = "https://api.build-check.linkly.test";
const OUT = ".wasp/out/web-app/build";

const read = (path: string) => readFileSync(join(OUT, path), "utf8");
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

describe("client build", () => {
  beforeAll(() => {
    execSync("wasp build", { stdio: "pipe" });
    execSync("npx vite build", { stdio: "pipe", env: { ...process.env, REACT_APP_API_URL: API_URL } });
  });

  it("writes llms.txt with the given API address", () => {
    const llmsTxt = read("llms.txt");
    expect(llmsTxt).toContain(`(${API_URL}/mcp)`);
    expect(llmsTxt).toContain(`(${API_URL}/api/v1/openapi.json)`);
  });

  it("prerenders the homepage with the For AI agents section", () => {
    const home = text(read("index.html"));
    expect(home).toContain("For AI agents");
    expect(home).toContain(`${API_URL}/mcp`);
    expect(home).toContain("/llms.txt");
  });

  it("prerenders the docs index and every doc page", () => {
    expect(text(read("docs/index.html"))).toContain(DOCS[0]!.title);
    const words = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[^A-Za-z0-9]+/g, " ").trim();
    for (const doc of DOCS) {
      const page = words(text(read(`docs/${doc.slug}/index.html`)));
      expect(page).toContain(words(doc.title));
      // The first words of the doc's text, with the build's API address filled in.
      const opening = words(doc.body.split("\n")[0]!.replaceAll("{{serverUrl}}", API_URL)).split(" ").slice(0, 8).join(" ");
      expect(page).toContain(opening);
    }
  });
});
