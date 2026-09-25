// Exit codes are part of the CLI's contract, so agents and scripts can branch on them.
export const EXIT = {
  ok: 0,
  unexpected: 1,
  usage: 2,
  unauthorized: 3,
  forbidden: 4,
  notFound: 5,
  conflict: 6,
} as const;

export class CliError extends Error {
  constructor(
    message: string,
    public exitCode: number,
    public code = "error",
  ) {
    super(message);
  }
}

export function exitCodeForStatus(status: number): number {
  if (status === 400 || status === 405) return EXIT.usage;
  if (status === 401) return EXIT.unauthorized;
  if (status === 403) return EXIT.forbidden;
  if (status === 404) return EXIT.notFound;
  if (status === 409) return EXIT.conflict;
  return EXIT.unexpected;
}
