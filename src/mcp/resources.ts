// Resources exposed by the MCP server. Slices contribute them.
import { docsResources } from "../docs/mcp";

export type ResourceDef = {
  name: string;
  uri: string;
  title: string;
  description: string;
  mimeType: string;
  read: () => Promise<string>;
};

export function allResources(): ResourceDef[] {
  return [...docsResources()];
}
