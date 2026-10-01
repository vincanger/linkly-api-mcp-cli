-- AlterTable
ALTER TABLE "AuthorizationCode" ADD COLUMN     "requestedScopes" TEXT[];

-- AlterTable
ALTER TABLE "Grant" ADD COLUMN     "requestedScopes" TEXT[];

-- Existing rows didn't record the request: use what was granted as the ceiling.
UPDATE "AuthorizationCode" SET "requestedScopes" = "scopes";
UPDATE "Grant" SET "requestedScopes" = "scopes";
