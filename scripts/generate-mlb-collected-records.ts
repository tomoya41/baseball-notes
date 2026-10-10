import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { collectedCountingRecords, type CollectedSeasonLine } from "../src/domain/mlb-collected-records";
const root = process.argv[2] ?? "dist/data/mlb/historical";
const requested = process.argv.includes("--competition") ? process.argv[process.argv.indexOf("--competition") + 1] : "both";
if (!["regular", "postseason", "both"].includes(requested ?? "")) throw Error("Invalid records competition");
for (const scope of (["regular", "postseason"] as const).filter(scope => requested === "both" || requested === scope)) {
  const base = scope === "regular" ? root : join(root, "postseason"), prefix = scope === "regular" ? "" : "postseason/";
  try { await access(join(base, "manifest.json.gz")); } catch { continue; }
  const read = async <T>(path: string): Promise<T> => {
    const data: unknown = JSON.parse(gunzipSync(await readFile(join(base, `${path}.gz`))).toString());
    if (!validStaticPayload(prefix + path, data)) throw Error(`Invalid range-records input ${prefix}${path}`);
    return data as T;
  };
  const manifest = await read<{ seasons: { season: number; coverage: string }[]; features: Record<string, string> }>("manifest.json");
  if (!manifest.seasons.length || manifest.seasons.some(s => s.coverage !== "complete")) throw Error("Incomplete collected-range source coverage");
  const names = new Map((await read<{ players: { id: string; name: string }[] }>("players/index.json")).players.map(p => [p.id, p.name]));
  const linesBySeason = new Map<number, CollectedSeasonLine[]>();
  for (const s of manifest.seasons) {
    const data = await read<{ coverage: string; players: CollectedSeasonLine[] }>(`seasons/${s.season}.json`);
    if (data.coverage !== "complete" || new Set(data.players.map(p => p.playerId)).size !== data.players.length || data.players.some(p => !names.has(p.playerId))) throw Error("Invalid range-records season");
    linesBySeason.set(s.season, data.players);
  }
  const years = manifest.seasons.map(s => s.season);
  const periods = [{ id: "range", label: "収録期間内合計", seasons: years },
    ...[...new Set(years.map(y => Math.floor(y / 10) * 10))].map(decade => ({ id: `decade-${decade}`, label: `${decade}年代の収録分`, seasons: years.filter(y => Math.floor(y / 10) * 10 === decade) }))];
  let compressedBytes = 0;
  for (const period of periods) {
    const result = { schemaVersion: 1, league: "MLB", ...(scope === "postseason" ? { competitionType: scope } : {}),
      collectedSeasons: period.seasons, coverage: "complete", counting: "ready", rate: "not_ready",
      records: collectedCountingRecords(period.seasons.flatMap(year => linesBySeason.get(year)!), names) };
    if (!validStaticPayload(prefix + `records/${period.id}.json`, result)) throw Error("Invalid collected-records output");
    const bytes = gzipSync(JSON.stringify(result), { level: 9 }); compressedBytes += bytes.length;
    await writeFile(join(base, `records/${period.id}.json.gz`), bytes);
  }
  await writeFile(join(base, "manifest.json.gz"), gzipSync(JSON.stringify({ ...manifest,
    collectedRecordPeriods: periods, features: { ...manifest.features, collectedCountingRecords: "available" } }), { level: 9 }));
  console.log(JSON.stringify({ scope, seasons: years, compressedBytes, files: periods.length, canonicalWrites: 0 }));
}
