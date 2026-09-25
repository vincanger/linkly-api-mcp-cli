import { ALL_SCOPES, type Scope } from "./scopes";
import { DomainError } from "./errors";

// Every service call takes a Principal, regardless of which adapter it came from.
export type Principal = {
  userId: string;
  scopes: Set<Scope>;
  source: "session" | "pat" | "oauth";
  grantId?: string; // oauth only
  clientName?: string; // oauth only: shown on confirm pages
  confirmDestructive: boolean; // session: false; pat: false; oauth: from grant
};

/** Dashboard sessions get every scope: the human is already in the product. */
export function principalFromSession(user: { id: string }): Principal {
  return { userId: user.id, scopes: new Set(ALL_SCOPES), source: "session", confirmDestructive: false };
}

export function principalFromPat(token: { userId: string; scopes: Scope[] }): Principal {
  return { userId: token.userId, scopes: new Set(token.scopes), source: "pat", confirmDestructive: false };
}

/** OAuth permissions come from the grant at request time, not from the token. */
export function principalFromGrant(grant: {
  id: string;
  userId: string;
  clientName: string;
  scopes: Scope[];
  confirmDestructive: boolean;
}): Principal {
  return {
    userId: grant.userId,
    scopes: new Set(grant.scopes),
    source: "oauth",
    grantId: grant.id,
    clientName: grant.clientName,
    confirmDestructive: grant.confirmDestructive,
  };
}

export function hasScope(p: Principal, scope: Scope): boolean {
  return p.scopes.has(scope);
}

export function requireScope(p: Principal, scope: Scope): void {
  if (!p.scopes.has(scope)) {
    throw new DomainError(
      "forbidden",
      `This action needs the "${scope}" permission, which this ${describeSource(p)} doesn't have.`,
      { requiredScope: scope },
    );
  }
}

export function requireSession(p: Principal, what: string): void {
  if (p.source !== "session") {
    throw new DomainError("forbidden", `${what} can only be done from the Linkly dashboard.`);
  }
}

function describeSource(p: Principal): string {
  if (p.source === "pat") return "personal access token";
  if (p.source === "oauth") return `connection (${p.clientName ?? "app"})`;
  return "session";
}
