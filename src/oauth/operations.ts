// Wasp operations used by the consent page and the connections page.
import { prisma } from "wasp/server";
import type {
  ApproveAuthorization,
  DenyAuthorization,
  GetAuthorizeRequest,
  GetGrants,
  RevokeGrant,
  UpdateGrant,
} from "wasp/server/operations";
import type { Toolset } from "../shared/scopes";
import { runOperation } from "../shared/waspErrors";
import { sessionPrincipal } from "../shared/waspSession";
import * as authorize from "./authorize";
import * as grants from "./grants";

const deps = { prisma };

export const getAuthorizeRequest: GetAuthorizeRequest<
  authorize.AuthorizeParams,
  authorize.ValidAuthorizeRequest | authorize.RedirectableAuthorizeError
> = (args, context) =>
  runOperation(async () => {
    sessionPrincipal(context);
    return authorize.validateAuthorizeRequest(args, deps);
  });

export const approveAuthorization: ApproveAuthorization<
  { params: authorize.AuthorizeParams; toolsets: Toolset[]; confirmDestructive: boolean },
  { redirectTo: string }
> = (args, context) => runOperation(() => authorize.approveAuthorization(sessionPrincipal(context), args, deps));

export const denyAuthorization: DenyAuthorization<{ params: authorize.AuthorizeParams }, { redirectTo: string }> = (args, context) =>
  runOperation(() => authorize.denyAuthorization(sessionPrincipal(context), args, deps));

export const getGrants: GetGrants<void, grants.GrantOut[]> = (_args, context) =>
  runOperation(() => grants.listGrants(sessionPrincipal(context), deps));

export const updateGrant: UpdateGrant<{ id: string; toolsets?: Toolset[]; confirmDestructive?: boolean }, void> = (args, context) =>
  runOperation(() => grants.updateGrant(sessionPrincipal(context), args, deps));

export const revokeGrant: RevokeGrant<{ id: string }, void> = (args, context) =>
  runOperation(() => grants.revokeGrant(sessionPrincipal(context), args, deps));
