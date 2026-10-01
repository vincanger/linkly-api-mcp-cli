import { beforeEach, describe, expect, it } from "vitest";
import { principalFromSession, type Principal } from "../shared/principal";
import { ALL_SCOPES } from "../shared/scopes";
import { createTestUser, prisma, resetDb } from "../test/db";
import { listGrants, updateGrant } from "./grants";

let user: Principal;

beforeEach(async () => {
  await resetDb();
  user = principalFromSession(await createTestUser());
});

/** A grant for an app that asked only for read access to links. */
const readOnlyGrant = () =>
  prisma.grant.create({
    data: { userId: user.userId, clientId: "https://client.example.com/meta.json", clientName: "Reader", scopes: ["links:read"], requestedScopes: ["links:read"] },
  });

describe("editing a connected app", () => {
  it("shows the scopes the app asked for next to the ones it has", async () => {
    await readOnlyGrant();
    expect(await listGrants(user, { prisma })).toMatchObject([{ scopes: ["links:read"], requestedScopes: ["links:read"] }]);
  });

  it("can narrow and restore scopes, but never grant more than the app asked for", async () => {
    const { id } = await readOnlyGrant();
    const scopesNow = async () => (await prisma.grant.findUniqueOrThrow({ where: { id } })).scopes;

    await updateGrant(user, { id, scopes: [...ALL_SCOPES] }, { prisma });
    expect(await scopesNow()).toEqual(["links:read"]);

    await updateGrant(user, { id, scopes: [] }, { prisma });
    expect(await scopesNow()).toEqual([]);

    await updateGrant(user, { id, scopes: ["links:read"] }, { prisma });
    expect(await scopesNow()).toEqual(["links:read"]);
  });

  it("leaves scopes alone when only the confirmation toggle changes", async () => {
    const { id } = await readOnlyGrant();
    await updateGrant(user, { id, confirmDestructive: false }, { prisma });
    expect(await prisma.grant.findUniqueOrThrow({ where: { id } })).toMatchObject({ scopes: ["links:read"], confirmDestructive: false });
  });
});
