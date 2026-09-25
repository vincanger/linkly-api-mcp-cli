import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SERVER_URL } from "../../e2e/env";

export const CLI = join(process.cwd(), "cli", "dist", "index.js");

export type RunResult = { code: number | null; stdout: string; stderr: string; json: () => any };

/**
 * Runs the built CLI as a subprocess. stdin is left open and never written
 * to: a command that tried to read it (or prompt) would hang and time out.
 */
export function runCli(args: string[], opts: { env?: Record<string, string>; stdin?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", LINKLY_URL: SERVER_URL, ...opts.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`linkly ${args.join(" ")} hung (did it wait for input?)`));
    }, opts.timeoutMs ?? 20_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      child.stdin.destroy();
      resolve({ code, stdout, stderr, json: () => JSON.parse(stdout) });
    });
  });
}

export const tempConfigDir = () => mkdtempSync(join(tmpdir(), "linkly-cli-"));
