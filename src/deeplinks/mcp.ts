import { z } from "zod";
import { GROUP_BYS, RANGES } from "../analytics/ranges";
import { asAny, defineTool } from "../mcp/defineTool";
import { DomainError } from "../shared/errors";
import { dashboardUrls } from "./urls";

const VIEWS = ["links", "link", "newLink", "topLinks", "connections", "tokens", "doc"] as const;

export function deeplinkTools() {
  return [
    asAny(
      defineTool({
        name: "get_dashboard_url",
        title: "Get a Linkly dashboard URL",
        toolset: "core",
        description:
          "Use this when the user wants to see, visualize, or manually edit something in Linkly: it returns a URL to open. Views: links = the link list (optional search/tag filter); link = one link (id required; tab edit or stats, with range/groupBy for the chart); newLink = the create form, prefilled with destinationUrl/slug/title/tags; topLinks = most-clicked links for a range; connections = connected apps; tokens = personal access tokens; doc = a docs page (id = doc slug from search_docs). Results from list_links, get_link, and get_link_stats already include a dashboardUrl.",
        input: {
          view: z
            .enum(VIEWS)
            .describe("Which page: links, link, newLink, topLinks, connections, tokens, or doc (see the tool description)."),
          id: z.string().max(200).optional().describe("Required for link (the link's ID or slug) and doc (the doc slug)."),
          params: z
            .object({
              search: z.string().optional().describe("links: prefill the search box."),
              tag: z.string().optional().describe("links: filter by this tag."),
              tab: z.enum(["edit", "stats"]).optional().describe("link: open the edit tab or the stats tab."),
              range: z.enum(RANGES).optional().describe("link (stats) and topLinks: time range 24h, 7d, 30d, or 90d."),
              groupBy: z.enum(GROUP_BYS).optional().describe("link (stats): chart by day or by referrer."),
              destinationUrl: z.string().optional().describe("newLink: prefill the destination URL."),
              slug: z.string().optional().describe("newLink: prefill the slug."),
              title: z.string().optional().describe("newLink: prefill the title."),
              tags: z.array(z.string()).optional().describe("newLink: prefill tags."),
            })
            .optional()
            .describe("Optional view-specific options; unrelated ones are ignored."),
        },
        output: {
          url: z.string().describe("The dashboard URL to open or share with the user."),
          view: z.enum(VIEWS).describe("The view the URL opens."),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        handler: async (_p, { view, id, params = {} }) => {
          const needsId = view === "link" || view === "doc";
          if (needsId && !id) throw new DomainError("invalid", `The ${view} view needs an id${view === "link" ? " (link ID or slug)" : " (doc slug)"}.`);
          const url = (() => {
            switch (view) {
              case "links":
                return dashboardUrls.links({ search: params.search, tag: params.tag });
              case "link":
                return dashboardUrls.link(id!, { tab: params.tab ?? (params.range || params.groupBy ? "stats" : undefined), range: params.range, groupBy: params.groupBy });
              case "newLink":
                return dashboardUrls.newLink({ destinationUrl: params.destinationUrl, slug: params.slug, title: params.title, tags: params.tags });
              case "topLinks":
                return dashboardUrls.topLinks({ range: params.range });
              case "connections":
                return dashboardUrls.connections();
              case "tokens":
                return dashboardUrls.tokens();
              case "doc":
                return dashboardUrls.doc(id!);
            }
          })();
          return { url, view };
        },
      }),
    ),
  ];
}
