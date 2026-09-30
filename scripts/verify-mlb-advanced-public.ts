import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import type { AdvancedPlayerPayload } from "../src/domain/mlb-pa-analysis";

const args = process.argv.slice(2), get = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1] ?? fallback : fallback;
const root = join(get("--output", ".data/mlb-public"), "data/mlb/historical");
const validation = JSON.parse(await readFile(get("--validation", ".data/mlb-pa-validation.json"), "utf8"));
const expected = new Map<string, number>(validation.seasons.map((row: { season: number; paRows: number }) => [String(row.season), row.paRows]));
expected.set("range", [...expected.values()].reduce((n, value) => n + value, 0));
let files = 0, bytes = 0, largest = 0;
const started = performance.now();
async function json(path: string) {
  const compressed = await readFile(join(root, `${path}.gz`));
  const text = gunzipSync(compressed).toString("utf8"), value = JSON.parse(text);
  if (!validStaticPayload(path, value)) throw new Error(`Invalid public payload: ${path}`);
  if (/"(?:batterId|pitcherId|outsBefore|baseStateBefore|rawHtml|source_id|retrosheetId|mlbamId|turso|credential)"/i.test(text))
    throw new Error(`Private or raw PA field in public payload: ${path}`);
  files++; bytes += compressed.length; largest = Math.max(largest, compressed.length);
  return value;
}
await json("manifest.json"); await json("advanced/capabilities.json");
const totals = [];
for (const [scope, expectedPa] of expected) {
  const byRole = { batting: 0, pitching: 0 };
  for (const file of await readdir(join(root, "advanced", scope))) {
    const payload = await json(`advanced/${scope}/${file.replace(/\.gz$/, "")}`) as AdvancedPlayerPayload;
    for (const role of ["batting", "pitching"] as const) {
      const section = payload[role], pa = section.opponents.reduce((n, row) => n + row.metrics.PA, 0);
      if (new Set(section.opponents.map(row => row.playerId)).size !== section.opponents.length) throw new Error("Duplicate BvP opponent");
      byRole[role] += pa;
      for (const family of ["inning", "outs", "bases", "score"]) {
        const splits = section.splits.filter(row => row.key.startsWith(`${family}:`) && row.key !== "bases:risp");
        const known = splits.reduce((n, row) => n + row.metrics.PA, 0);
        if (known > pa || splits.some(row => row.unknownPa !== pa - known)) throw new Error("Situation sample partition mismatch");
        if (family === "inning" && known !== pa) throw new Error("Inning coverage mismatch");
      }
    }
  }
  if (byRole.batting !== expectedPa || byRole.pitching !== expectedPa) throw new Error(`Public PA total mismatch: ${scope}`);
  totals.push({ scope, expectedPa, ...byRole });
}
for (const season of validation.seasons) {
  const records = await json(`records/${season.season}.json`);
  for (const record of records.records) if (record.classification === "rate") {
    for (let i = 1; i < record.rows.length; i++) {
      const a = record.rows[i - 1], b = record.rows[i];
      if (record.metric === "ERA" ? a.rankingValue > b.rankingValue : a.rankingValue < b.rankingValue)
        throw new Error("Rate ranking order mismatch");
      if (a.rankingValue === b.rankingValue && a.rank !== b.rank) throw new Error("Rate ranking tie mismatch");
    }
  }
}
const report = { result: "PASS", totals, files, compressedBytes: bytes, largestPayload: largest, dbWrites: 0,
  runtimeMs: Math.round(performance.now() - started) };
await writeFile(get("--report", ".data/mlb-advanced-public-audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
