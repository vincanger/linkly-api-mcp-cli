// Output rules: --json (or any non-TTY stdout) prints exactly the REST
// response body; humans get compact text built from the same data.
// Errors always go to stderr.
import { CliError } from "./errors.js";

export type Io = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  isTTY: boolean;
};

export const processIo: Io = {
  stdout: (text) => void process.stdout.write(text.endsWith("\n") ? text : text + "\n"),
  stderr: (text) => void process.stderr.write(text.endsWith("\n") ? text : text + "\n"),
  isTTY: !!process.stdout.isTTY,
};

export function wantsJson(io: Io, opts: { json?: boolean }): boolean {
  return !!opts.json || !io.isTTY;
}

export function printResult(io: Io, opts: { json?: boolean }, data: unknown, human: () => string): void {
  io.stdout(wantsJson(io, opts) ? JSON.stringify(data, null, 2) : human());
}

export function printError(io: Io, opts: { json?: boolean }, error: CliError): void {
  if (wantsJson(io, opts)) io.stderr(JSON.stringify({ error: { code: error.code, message: error.message } }));
  else io.stderr(`Error: ${error.message}`);
}

/** A plain-text table with padded columns. */
export function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "(none)";
  const widths = headers.map((h, i) => Math.min(60, Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))));
  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => {
        const cell = c.length > widths[i]! ? c.slice(0, widths[i]! - 1) + "…" : c;
        return i === cells.length - 1 ? cell : cell.padEnd(widths[i]!);
      })
      .join("  ");
  return [fmt(headers), ...rows.map(fmt)].join("\n");
}

export function fields(entries: [string, string | number | null | undefined][]): string {
  const width = Math.max(...entries.map(([k]) => k.length));
  return entries
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k.padEnd(width)}  ${v ?? "—"}`)
    .join("\n");
}
