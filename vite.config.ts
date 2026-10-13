import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { wasp } from "wasp/client/vite";
import { renderLlmsTxt } from "./src/discovery/llmsTxt";
import { LLMS_TXT_PATH } from "./src/discovery/paths";

export default defineConfig({
  plugins: [wasp(), tailwindcss(), llmsTxt()],
  server: {
    open: false,
  },
  // Pre-bundle dependencies that are only discovered on some pages, so Vite
  // doesn't reload the page the first time one of those pages is visited.
  optimizeDeps: {
    include: [
      "@hookform/resolvers/zod",
      "react-hook-form",
      "recharts",
      "radix-ui",
      "lucide-react",
      "sonner",
      "next-themes",
      "zod",
      "@asteasolutions/zod-to-openapi",
      "class-variance-authority",
      "cn",
      "react-markdown",
    ],
  },
});

/**
 * Serves /llms.txt from the dev server and writes it into the client build,
 * so every `wasp start`, `wasp build`, and deploy has it with no extra step.
 * The API address is the same REACT_APP_API_URL the client build already
 * requires; Wasp's plugin has loaded it into `define` by now.
 */
function llmsTxt(): Plugin {
  let body = "";
  return {
    name: "linkly:llms-txt",
    configResolved(config) {
      const defined = config.define?.["import.meta.env.REACT_APP_API_URL"];
      if (!defined && config.command === "build") {
        throw new Error("Set REACT_APP_API_URL to the API server's URL: /llms.txt links to it.");
      }
      // Wasp's dev default for REACT_APP_API_URL.
      body = renderLlmsTxt({ serverUrl: defined ? JSON.parse(defined) : "http://localhost:3001" });
    },
    configureServer(server) {
      server.middlewares.use(LLMS_TXT_PATH, (_req, res) => {
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.end(body);
      });
    },
    generateBundle() {
      // The prerender (SSR) build runs these hooks too; the file belongs in the client output.
      if (this.environment.name !== "client") return;
      this.emitFile({ type: "asset", fileName: LLMS_TXT_PATH.slice(1), source: body });
    },
  };
}
