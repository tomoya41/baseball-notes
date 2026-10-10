import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { collectedCountingRecords, type CollectedSeasonLine } from "../src/domain/mlb-collected-records";
const root = process.argv[2] ?? "dist/data/mlb/historical";
let checked = 0;
for (const scope of ["regular", "postseason"] as const) {
  const base = scope === "regular" ? root : join(root, "postseason"), prefix = scope === "regular" ? "" : "postseason/";
  const read = async <T>(path: string): Promise<T> => {
    const data: unknown = JSON.parse(gunzipSync(await readFile(join(base, `${path}.gz`))).toString());
    if (!validStaticPayload(prefix + path, data)) throw Error(`Invalid records input ${path}`);
    return data as T;
  };
  let manifest;
  try { manifest = await read<{ seasons: { season: number; coverage: string }[]; features?: { collectedCountingRecords?: string }; collectedRecordPeriods?: { id: string; seasons: number[] }[] }>("manifest.json"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
  if (manifest.features?.collectedCountingRecords !== "available") continue;
  const names = new Map((await read<{ players: { id: string; name: string }[] }>("players/index.json")).players.map(p => [p.id, p.name]));
  for (const period of manifest.collectedRecordPeriods!) {
    const lines: CollectedSeasonLine[] = [];
    for (const season of period.seasons) {
      const data = await read<{ coverage: string; players: CollectedSeasonLine[] }>(`seasons/${season}.json`);
      if (data.coverage !== "complete" || manifest.seasons.find(s => s.season === season)?.coverage !== "complete") throw Error("Collected records incomplete source");
      lines.push(...data.players);
    }
    const actual = await read<{ collectedSeasons: number[]; records: unknown }>(`records/${period.id}.json`);
    if (!isDeepStrictEqual(actual.collectedSeasons, period.seasons) || !isDeepStrictEqual(actual.records, collectedCountingRecords(lines, names))) throw Error(`Collected records aggregate mismatch ${scope} ${period.id}`);
    checked++;
  }
}
console.log(JSON.stringify({ result: "PASS", periodsChecked: checked, canonicalWrites: 0 }));
