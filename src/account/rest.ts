import { prisma } from "wasp/server";
import type { RestMe } from "wasp/server/api";
import { withBearer } from "../shared/http";
import { whoami } from "./service";

export const restMe: RestMe = withBearer("api", async (_req, res, principal) => {
  res.json(await whoami(principal, { prisma }));
});
