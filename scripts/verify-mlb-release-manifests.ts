import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { MLB_BASELINE_SEASONS, MLB_HISTORICAL_SEASONS } from "../src/domain/mlb-historical-seasons";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
const root = process.argv[2], mode = process.argv[3];
if (!root || !["expansion", "release", "postseason", "app-only"].includes(mode)) throw Error("Explicit root and publication mode required");
for (const scope of ["regular", "postseason"] as const) {
  const path = scope === "regular" ? "manifest.json" : "postseason/manifest.json";
  const payload: unknown = JSON.parse(gunzipSync(await readFile(join(root, `${path}.gz`))).toString());
  if (!validStaticPayload(path, payload)) throw Error(`Invalid ${scope} manifest`);
  const manifest = payload as { current2026: string; seasons: { season: number; coverage: string }[] };
  const years = manifest.seasons.map(s => s.season).sort((a, b) => a - b), key = JSON.stringify(years);
  const expanded = mode === "expansion" || mode === "release" && scope === "regular" || mode === "postseason" && scope === "postseason";
  if (manifest.current2026 !== "unavailable" || manifest.seasons.some(s => s.coverage !== "complete") || !(expanded ? key === JSON.stringify(MLB_HISTORICAL_SEASONS) : [JSON.stringify(MLB_BASELINE_SEASONS), JSON.stringify(MLB_HISTORICAL_SEASONS)].includes(key))) throw Error(`Unsupported/incomplete ${scope} release years`);
  console.log(JSON.stringify({ scope, years, coverage: "complete", current2026: "unavailable" }));
}
