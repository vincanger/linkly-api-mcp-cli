// A typed REST client generated from the committed OpenAPI snapshot. The CLI
// talks only to the REST API: it never imports server code.
import createClient from "openapi-fetch";
import { CliError, exitCodeForStatus } from "./errors.js";
import type { paths } from "./schema.js";

export type Api = ReturnType<typeof createApi>;

export function createApi(baseUrl: string, token?: string) {
  return createClient<paths>({
    baseUrl: `${baseUrl}/api/v1`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Unwraps an openapi-fetch result, turning HTTP errors into CliErrors with the right exit code. */
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<{ data: T; status: number }> {
  let result: Result<T>;
  try {
    result = await promise;
  } catch (e) {
    throw new CliError(`Couldn't reach the Linkly server: ${(e as Error).message}. Check --url or LINKLY_URL.`, 1, "network");
  }
  const { data, error, response } = result;
  if (!response.ok || error !== undefined) {
    const body = error as { error?: { code?: string; message?: string } } | undefined;
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    throw new CliError(message, exitCodeForStatus(response.status), body?.error?.code ?? `http_${response.status}`);
  }
  return { data: data as T, status: response.status };
}
