import { prisma } from "wasp/server";
import type { CreatePat, GetPats, RevokePat } from "wasp/server/operations";
import { runOperation } from "../shared/waspErrors";
import { sessionPrincipal } from "../shared/waspSession";
import type { PatInput, PatOut } from "./schemas";
import * as tokens from "./service";

const deps = { prisma };

export const getPats: GetPats<void, PatOut[]> = (_args, context) =>
  runOperation(() => tokens.listPats(sessionPrincipal(context), deps));

export const createPat: CreatePat<PatInput, { token: string; pat: PatOut }> = (args, context) =>
  runOperation(() => tokens.createPat(sessionPrincipal(context), args, deps));

export const revokePat: RevokePat<{ id: string }, PatOut> = (args, context) =>
  runOperation(() => tokens.revokePat(sessionPrincipal(context), args, deps));
