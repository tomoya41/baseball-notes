import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Local UI development uses the published, validated data; never fixture fallback.
  server: {
    watch: { ignored: ["**/.data/**", "**/android/**"] },
    proxy: { "/data": { target: "https://tomoya41.github.io/baseball-notes", changeOrigin: true } },
  },
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
});
