/** Independent CSV column sums checked against canonical season read models. No DB writes. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { readHistoricalCsv, isRegularRetrosheetGame, POSTSEASON_GAME_TYPES, chadwickBridge, historicalId } from "../src/data/mlb-historical";
const args = process.argv.slice(2), get = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1]! : fallback;
const cache = get("--cache", ".data"), root = get("--root", ".data/mlb-public/data/mlb/historical");
const read = async (path: string) => JSON.parse(gunzipSync(await readFile(path)).toString());
const checks: { season: number; scope: string; playerMetrics: number }[] = [];
const mapping = new Map([...chadwickBridge(await readFile(join(cache, "chadwick-register.zip")))].map(([retro, uuid]) => [retro, historicalId("player", `chadwick:${uuid}`)]));
for (const scope of ["regular", "postseason"] as const) {
  const base = scope === "regular" ? root : get("--post-root", join(root, "postseason"));
  for (const season of [2016, 2017, 2018, 2019]) {
    const archive = await readFile(join(cache, `${season}csvs.zip`));
    const ids = new Set(readHistoricalCsv(archive, season, "gameinfo").filter(row => scope === "regular" ? isRegularRetrosheetGame(row.gametype ?? "") :
      POSTSEASON_GAME_TYPES.includes(row.gametype ?? "")).map(row => row.gid));
    const payload = await read(join(base, `seasons/${season}.json.gz`));
    if (ids.size !== payload.gameCount) throw Error(`${season} ${scope} Game count mismatch`);
    let playerMetrics = 0;
    for (const [role, columns] of [["batting", { PA: "b_pa", AB: "b_ab", R: "b_r", H: "b_h", HR: "b_hr", RBI: "b_rbi", BB: "b_w", HBP: "b_hbp", SO: "b_k" }],
      ["pitching", { BF: "p_bfp", H: "p_h", HR: "p_hr", BB: "p_w", SO: "p_k", R: "p_r", ER: "p_er" }]] as const) {
      const totals = new Map<string, Record<string, number | null>>();
      for (const row of readHistoricalCsv(archive, season, role)) {
        if (!ids.has(row.gid)) continue;
        const id = mapping.get(row.id!); if (!id) throw Error("Unmapped independent aggregate identity");
        const values = totals.get(id) ?? {};
        for (const [metric, column] of Object.entries(columns)) {
          const value = row[column];
          if (value === undefined || value === "" || values[metric] === null) values[metric] = null;
          else values[metric] = (values[metric] ?? 0) + Number(value);
        }
        totals.set(id, values);
      }
      const actual = new Map<string, Record<string, { value: number | null }> | null>(payload.players.map((p: { playerId: string; batting: unknown; pitching: unknown }) => [p.playerId, p[role]]));
      for (const [id, values] of totals) for (const [metric, value] of Object.entries(values)) {
        if (actual.get(id)?.[metric]?.value !== value) throw Error(`${season} ${scope} ${id} ${role} ${metric} mismatch`);
        playerMetrics++;
      }
    }
    checks.push({ season, scope, playerMetrics });
  }
}
const result = { result: "PASS", checks, canonicalWrites: 0 };
await writeFile(get("--report", ".data/mlb-expanded-aggregates.json"), JSON.stringify(result)); console.log(JSON.stringify(result));
