import { build } from "esbuild";

await build({
  entryPoints: { recent: "src/server-recent.ts", "game-log": "src/server-game-log.ts" },
  outdir: "api/npb",
  entryNames: "[name]",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: false,
});
