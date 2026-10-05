import { z } from "../shared/zod";
import { ALL_SCOPES, ALL_TOOLSETS } from "../shared/scopes";

export const Whoami = z
  .object({
    userId: z.string().describe("Your Linkly user ID."),
    username: z.string().nullable().describe("The username you log in with."),
    source: z.enum(["session", "pat", "oauth"]).describe("How this request is authenticated: dashboard session, personal access token, or OAuth connection."),
    scopes: z.array(z.enum(ALL_SCOPES as [string, ...string[]])).describe("Permissions this caller has."),
    toolsets: z.array(z.enum(ALL_TOOLSETS as [string, ...string[]])).describe("Toolsets fully covered by those permissions."),
    confirmDestructive: z.boolean().describe("If true, deletions return a confirmation link for the user instead of deleting immediately."),
    clientName: z.string().nullable().describe("For OAuth connections, the name of the connected app."),
    dashboardUrl: z.string().describe("Opens the Linkly dashboard."),
  })
  .openapi("Whoami");
export type Whoami = z.infer<typeof Whoami>;
