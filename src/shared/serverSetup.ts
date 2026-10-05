import { env, type ServerSetupFn } from "wasp/server";
import { requestStateKey } from "../mcp/confirmations";
import { configureUrls } from "./urls";

// Wasp's env config is the source of truth for public URLs at runtime.
export const serverSetup: ServerSetupFn = async () => {
  configureUrls({ serverUrl: env.WASP_SERVER_URL, frontendUrl: env.WASP_WEB_CLIENT_URL });
  requestStateKey(); // fail at startup, not on the first confirmation, if the MCP signing key is missing
};
