import { z } from "zod";
import { asAny, defineTool } from "../mcp/defineTool";
import type { ResourceDef } from "../mcp/resources";
import { DOCS } from "./content";
import { DocOut, DocSearchResults } from "./schemas";
import { readDoc, searchDocs } from "./service";

export function docsTools() {
  return [
    asAny(
      defineTool({
        name: "search_docs",
        title: "Search Linkly docs",
        toolset: "core",
        description:
          "Searches Linkly's documentation and returns the best-matching docs with snippets. Use it whenever you're unsure how a Linkly concept works (slugs, tags, how clicks are counted, time ranges, permissions, confirmations) before calling other tools. Then use read_doc for the full text.",
        input: {
          query: z.string().min(1).max(200).describe("What you want to know, in plain words, e.g. \"how are clicks counted\"."),
          limit: z.number().int().min(1).max(20).optional().describe("Maximum number of results, 1–20 (default 5)."),
        },
        output: DocSearchResults.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: async (_p, input) => searchDocs(input),
      }),
    ),
    asAny(
      defineTool({
        name: "read_doc",
        title: "Read a Linkly doc",
        toolset: "core",
        description:
          "Returns the full Markdown of one Linkly doc by its slug (from search_docs results). Docs are also available as MCP resources at docs://linkly/<slug>.",
        input: { slug: z.string().min(1).max(100).describe("The doc's slug, e.g. \"how-clicks-are-counted\".") },
        output: DocOut.shape,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: async (_p, input) => readDoc(input),
      }),
    ),
  ];
}

export function docsResources(): ResourceDef[] {
  return DOCS.map((doc) => ({
    name: `doc-${doc.slug}`,
    uri: `docs://linkly/${doc.slug}`,
    title: doc.title,
    description: `Linkly docs: ${doc.title}`,
    mimeType: "text/markdown",
    read: async () => `# ${doc.title}\n\n${readDoc({ slug: doc.slug }).markdown}`,
  }));
}
