import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 3020 so a running deployment's app (3010) and API (3001) are untouched while the shell is
// developed against them.
export default defineConfig({
  define: {
    "process.env.DO_NOT_TRACK": JSON.stringify("1"),
    "process.env.COPILOTKIT_TELEMETRY_DISABLED": JSON.stringify("true"),
    "process.env.COPILOTKIT_TELEMETRY_SAMPLE_RATE": JSON.stringify("0"),
    "process.env.SCARF_ANALYTICS": JSON.stringify("false"),
  },
  plugins: [react()],
  clearScreen: false,
  server: { port: 3020, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
