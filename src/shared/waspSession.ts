// Wasp adapter: turns an operation's context into a session Principal.
import { HttpError } from "wasp/server";
import { principalFromSession, type Principal } from "./principal";

export function sessionPrincipal(context: { user?: { id: string } | null }): Principal {
  if (!context.user) throw new HttpError(401, "Log in to continue.");
  return principalFromSession(context.user);
}
