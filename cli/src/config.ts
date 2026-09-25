// Where the token and server URL come from: flag, then env var, then the
// config file. Nothing is ever asked for interactively.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CliError, EXIT } from "./errors.js";

export const DEFAULT_URL = "http://localhost:3001";

type ConfigFile = { url?: string; token?: string };

export function configDir(): string {
  if (process.env.LINKLY_CONFIG_DIR) return process.env.LINKLY_CONFIG_DIR;
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "linkly");
}

export const configPath = () => join(configDir(), "config.json");

export function readConfig(): ConfigFile {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ConfigFile;
  } catch {
    throw new CliError(`The config file ${path} isn't valid JSON. Fix or delete it.`, EXIT.usage);
  }
}

/** Written with mode 0600: it holds a token. */
export function writeConfig(config: ConfigFile): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  chmodSync(configPath(), 0o600);
}

export function clearToken(): boolean {
  const config = readConfig();
  if (!config.token) return false;
  delete config.token;
  if (Object.keys(config).length === 0) rmSync(configPath(), { force: true });
  else writeConfig(config);
  return true;
}

export type GlobalOptions = { url?: string; token?: string; json?: boolean };

export function resolveUrl(opts: GlobalOptions): string {
  return (opts.url ?? process.env.LINKLY_URL ?? readConfig().url ?? DEFAULT_URL).replace(/\/+$/, "");
}

export function resolveToken(opts: GlobalOptions): string {
  const token = opts.token ?? process.env.LINKLY_TOKEN ?? readConfig().token;
  if (!token) {
    throw new CliError(
      "No token. Create one on the Tokens page of your Linkly dashboard (/settings/tokens), then run `linkly auth login --token <token>` or set LINKLY_TOKEN.",
      EXIT.unauthorized,
      "unauthorized",
    );
  }
  return token;
}
