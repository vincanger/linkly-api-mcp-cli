// Domain errors are the only errors services throw. Each adapter maps them
// to its own shape: Wasp HttpError (see waspErrors.ts), a REST JSON body, or
// an MCP tool error result.

export type DomainErrorCode = "not_found" | "forbidden" | "conflict" | "invalid" | "unauthorized";

export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const HTTP_STATUS: Record<DomainErrorCode, number> = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

export type ErrorBody = { error: { code: string; message: string; details?: unknown } };

/** Normalizes anything thrown into a status + JSON body. Unknown errors become a generic 500. */
export function toErrorResponse(e: unknown): { status: number; body: ErrorBody } {
  const domain = asDomainError(e);
  if (domain) {
    const body: ErrorBody = { error: { code: domain.code, message: domain.message } };
    if (domain.details !== undefined) body.error.details = domain.details;
    return { status: HTTP_STATUS[domain.code], body };
  }
  return { status: 500, body: { error: { code: "internal", message: "Internal server error." } } };
}

type ResponseLike = { status(code: number): ResponseLike; json(body: unknown): unknown };

export function toHttpResponse(e: unknown, res: ResponseLike): void {
  const { status, body } = toErrorResponse(e);
  if (status === 500) console.error(e);
  res.status(status).json(body);
}

export type McpErrorResult = {
  isError: true;
  content: { type: "text"; text: string }[];
};

/** MCP errors are written for agents: the message says what to do next. */
export function toMcpToolError(e: unknown): McpErrorResult {
  const domain = asDomainError(e);
  if (!domain) console.error(e);
  const text = domain
    ? `${domain.code}: ${domain.message}`
    : "internal: Something went wrong on the Linkly server. Try again, and if it keeps failing, tell the user.";
  return { isError: true, content: [{ type: "text", text }] };
}

/** Zod validation errors are reported as `invalid` with a readable summary. */
export function asDomainError(e: unknown): DomainError | null {
  if (e instanceof DomainError) return e;
  if (isZodError(e)) {
    const summary = e.issues
      .map((i) => `${i.path.length ? i.path.join(".") : "input"}: ${i.message}`)
      .join("; ");
    return new DomainError("invalid", `Invalid input. ${summary}`, e.issues);
  }
  return null;
}

type ZodLikeError = { name: string; issues: { path: PropertyKey[]; message: string }[] };

function isZodError(e: unknown): e is ZodLikeError {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { name?: unknown }).name === "ZodError" &&
    Array.isArray((e as { issues?: unknown }).issues)
  );
}
