import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pagesBase = "/Flowtake/";

export default defineConfig(({ mode }) => ({
  // GitHub project Pages serves this repository below /Flowtake/. Keep the
  // default root base for local development and ordinary local previews.
  base: mode === "pages" ? pagesBase : "/",
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
}));
