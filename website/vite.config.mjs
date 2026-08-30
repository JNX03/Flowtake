import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesBase = "/Flowtake/";

export default defineConfig(({ mode }) => ({
  appType: "mpa",
  // GitHub project Pages serves this repository below /Flowtake/. Keep the
  // default root base for local development and ordinary local previews.
  base: mode === "pages" ? pagesBase : "/",
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        screenStudioAlternativeWindows: resolve(
          __dirname,
          "screen-studio-alternative-windows/index.html",
        ),
        developerToolDemoStoryboard: resolve(
          __dirname,
          "developer-tool-demo-storyboard/index.html",
        ),
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: [
        "./src/main.jsx",
        "./src/screenStudioAlternative.main.jsx",
        "./src/developerToolDemoStoryboard.main.js",
      ],
    },
  },
  plugins: [react()],
}));
