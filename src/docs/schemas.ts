import { z } from "../shared/zod";

export const DocSearchResult = z
  .object({
    slug: z.string().describe("Pass to read_doc (or GET /docs/{slug}) for the full text."),
    title: z.string().describe("Doc title."),
    snippet: z.string().describe("A short excerpt around the best match."),
    score: z.number().describe("Relevance score; higher is better."),
    url: z.string().describe("Opens the doc in the Linkly dashboard."),
  })
  .openapi("DocSearchResult");

export const DocSearchResults = z
  .object({ results: z.array(DocSearchResult).describe("Matching docs, best first.") })
  .openapi("DocSearchResults");

export const DocOut = z
  .object({
    slug: z.string().describe("Doc slug."),
    title: z.string().describe("Doc title."),
    tags: z.array(z.string()).describe("Topics the doc covers."),
    markdown: z.string().describe("The full doc as Markdown."),
    url: z.string().describe("Opens the doc in the Linkly dashboard."),
  })
  .openapi("Doc");
export type DocOut = z.infer<typeof DocOut>;
