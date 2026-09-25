import { build } from "esbuild";

await build({
  entryPoints: ["src/server-recent.ts"],
  outfile: "api/npb/recent.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: false,
});
