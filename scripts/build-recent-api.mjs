import { build } from "esbuild";

await build({
  entryPoints: { recent: "src/server-recent.ts", "game-log": "src/server-game-log.ts",
    "game-detail": "src/server-game-detail.ts",
    analysis: "src/server-analysis.ts", "home-away": "src/server-home-away.ts",
    opponent: "src/server-opponent.ts", "analysis-bundle": "src/server-analysis-bundle.ts" },
  outdir: "api/npb",
  entryNames: "[name]",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: false,
});
