import { createHash, randomBytes } from "node:crypto";

// Raw tokens and codes are never stored: only their SHA-256 hex digest.
export const TOKEN_PREFIX = { pat: "lk_pat_", access: "lk_at_", refresh: "lk_rt_", code: "lk_code_" } as const;

export function generateSecret(prefix: string): string {
  return prefix + randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
