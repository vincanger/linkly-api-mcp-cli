import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { TEST_DATABASE_URL } from "../env";

// Direct access to the test database for fixtures that don't need Wasp
// (tokens are just hashed rows).
export const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createPatFor(userId: string, scopes: string[]): Promise<string> {
  const token = `lk_pat_${randomBytes(32).toString("base64url")}`;
  await db.accessToken.create({ data: { tokenHash: sha256(token), kind: "pat", userId, name: "test", scopes } });
  return token;
}
