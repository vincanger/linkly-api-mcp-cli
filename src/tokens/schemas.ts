import { z } from "../shared/zod";
import { ALL_SCOPES } from "../shared/scopes";

const scopeEnum = z.enum(ALL_SCOPES as [string, ...string[]]);

export const PatInput = z.object({
  name: z.string().trim().min(1, "Give the token a name.").max(100).describe("A label to recognize the token later."),
  scopes: z.array(scopeEnum).min(1, "Pick at least one permission.").describe("Permissions the token grants."),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional().describe("Days until the token expires. Omit or null for no expiry."),
});
export type PatInput = z.infer<typeof PatInput>;

export type PatOut = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
