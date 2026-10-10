import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { openDataClient } from "../src/data/database";
import { HISTORICAL_SEASONS } from "../src/data/mlb-historical";
import { historicalAdvancedGate, paAnalysisMetrics, type AdvancedPlayerPayload } from "../src/domain/mlb-pa-analysis";
import { paCountFields, type PaCounts } from "../src/domain/mlb-plate-appearance";
import { competitionTypeSchema } from "../src/domain/competition";

const args = process.argv.slice(2), get = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] ?? fallback : fallback;
const competition = competitionTypeSchema.parse(get("--competition", "regular"));
const root = join(get("--output", ".data/mlb-public"), "data/mlb/historical", ...(competition === "postseason" ? ["postseason"] : []));
const client = openDataClient(`file:${get("--db", ".data/mlb-historical.sqlite")}`);
// Season-wide grouping must not traverse the opponent lookup indexes and fetch
// every PA in random index order. Group temporary rows in memory, with a bounded
// single-season source; individual matchup queries retain their existing indexes.
await client.execute("PRAGMA temp_store=MEMORY");
const started = performance.now();
const validation = JSON.parse(await readFile(get("--validation", ".data/mlb-pa-validation.json"), "utf8"));
if ((validation.competition ?? "regular") !== competition) throw new Error("Advanced competition validation mismatch");
const storedScope = await client.execute("SELECT DISTINCT COALESCE(json_extract(payload_json,'$.competitionType'),'regular') AS scope FROM mlb_historical_games");
if (storedScope.rows.some(row => row.scope !== competition)) throw new Error("Advanced database competition mismatch");
const expectedSeasons = (await client.execute("SELECT season FROM mlb_historical_releases ORDER BY season")).rows.map(row => Number(row.season));
const gate = historicalAdvancedGate(validation.seasons, expectedSeasons);
const playerSeasons = new Map<string, number[]>();
const players = new Map((await client.execute("SELECT player_id,payload_json FROM mlb_historical_players")).rows.map(row => {
  const player = JSON.parse(String(row.payload_json)); playerSeasons.set(String(row.player_id), player.seasons);
  return [String(row.player_id), String(player.name)];
}));
let selects = 2, payloadBytes = 0, payloadFiles = 0, largestPayload = 0;
const rangePairs = new Map<string, { batterId: string; pitcherId: string; counts: PaCounts }>();
const rangeSplits = new Map<string, { playerId: string; role: "batting" | "pitching"; key: string; counts: PaCounts }>();
const sumColumns = `COUNT(*) AS PA,${paCountFields.map(field => `SUM(${field}) AS ${field}`).join(",")}`;
const counts = (row: Record<string, unknown>): PaCounts => Object.fromEntries(["PA", ...paCountFields].map(field => [field, Number(row[field])])) as PaCounts;
const add = (target: PaCounts, source: PaCounts) => { target.PA += source.PA; for (const field of paCountFields) target[field] += source[field]; };
async function json(relative: string, payload: unknown) {
  const scoped = competition === "postseason" ? { ...(payload as object), competitionType: "postseason" } : payload;
  const file = join(root, `${relative}.gz`), bytes = gzipSync(Buffer.from(JSON.stringify(scoped)), { level: 9 });
  await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes);
  payloadBytes += bytes.length; largestPayload = Math.max(largestPayload, bytes.length); payloadFiles++;
}
const make = (id: string, scope: string): AdvancedPlayerPayload => ({ schemaVersion: 1, league: "MLB", playerId: id,
  scope, ...gate, batting: { opponents: [], splits: [] }, pitching: { opponents: [], splits: [] } });
async function publish(scope: string, pairs: Iterable<{ batterId: string; pitcherId: string; counts: PaCounts }>,
  splits: Iterable<{ playerId: string; role: "batting" | "pitching"; key: string; counts: PaCounts }>) {
  const output = new Map<string, AdvancedPlayerPayload>();
  const player = (id: string) => { const p = output.get(id) ?? make(id, scope); output.set(id, p); return p; };
  if (gate.directBvp === "ready") for (const pair of pairs) {
    const metrics = paAnalysisMetrics(pair.counts);
    player(pair.batterId).batting.opponents.push({ playerId: pair.pitcherId, name: players.get(pair.pitcherId)!, metrics });
    player(pair.pitcherId).pitching.opponents.push({ playerId: pair.batterId, name: players.get(pair.batterId)!, metrics });
  }
  if (gate.situations === "ready") for (const split of splits) {
    player(split.playerId)[split.role].splits.push({ key: split.key, metrics: paAnalysisMetrics(split.counts), unknownPa: 0 });
  }
  // Even a player with no PA gets an explicit empty capability payload.
  for (const id of players.keys()) if (scope === "range" || playerSeasons.get(id)?.includes(Number(scope))) player(id);
  for (const p of output.values()) for (const role of ["batting", "pitching"] as const) {
    const section = p[role]; section.opponents.sort((a, b) => b.metrics.PA - a.metrics.PA || a.name.localeCompare(b.name, "en") || a.playerId.localeCompare(b.playerId));
    section.splits.sort((a, b) => a.key.localeCompare(b.key));
    const totalPa = section.opponents.reduce((n, row) => n + row.metrics.PA, 0);
    for (const split of section.splits) {
      const family = split.key.split(":")[0];
      const knownPa = section.splits.filter(row => row.key.startsWith(`${family}:`) && row.key !== "bases:risp")
        .reduce((n, row) => n + row.metrics.PA, 0);
      split.unknownPa = totalPa - knownPa;
    }
  }
  for (const p of output.values()) await json(`advanced/${scope}/${p.playerId.replaceAll(":", "_")}.json`, p);
}
for (const season of HISTORICAL_SEASONS.filter(year => expectedSeasons.includes(year))) {
  const pairRows = await client.execute({ sql: `SELECT batterId,pitcherId,${sumColumns} FROM mlb_historical_plate_appearances NOT INDEXED
    WHERE season=? GROUP BY batterId,pitcherId`, args: [season] }); selects++;
  const pairs = pairRows.rows.map(row => ({ batterId: String(row.batterId), pitcherId: String(row.pitcherId), counts: counts(row) }));
  for (const pair of pairs) {
    const key = `${pair.batterId}|${pair.pitcherId}`, existing = rangePairs.get(key);
    if (existing) add(existing.counts, pair.counts); else rangePairs.set(key, { ...pair, counts: { ...pair.counts } });
  }
  const columns = ["season", "inning", "outsBefore", "baseStateBefore", "battingScoreBefore", "fieldingScoreBefore", "batterId", "pitcherId", ...paCountFields].join(",");
  const dimensions = [
    ["'inning:'||CASE WHEN inning<=3 THEN '1–3' WHEN inning<=6 THEN '4–6' WHEN inning<=9 THEN '7–9' ELSE 'extra' END", "1"],
    ["'outs:'||outsBefore", "outsBefore IS NOT NULL"],
    ["'bases:'||CASE WHEN baseStateBefore=0 THEN 'empty' ELSE 'runners' END", "baseStateBefore IS NOT NULL"],
    ["'bases:risp'", "baseStateBefore IS NOT NULL AND (baseStateBefore&6)<>0"],
  ];
  const union = (["batting", "pitching"] as const).flatMap(role => {
    const own = role === "batting" ? "battingScoreBefore" : "fieldingScoreBefore";
    const other = role === "batting" ? "fieldingScoreBefore" : "battingScoreBefore";
    const specs = [...dimensions, [`'score:'||CASE WHEN ${own}=${other} THEN 'tied' WHEN ${own}>${other} THEN 'ahead' ELSE 'behind' END`, "battingScoreBefore IS NOT NULL AND fieldingScoreBefore IS NOT NULL"]];
    return specs.map(([key, where]) => `SELECT '${role}' AS role,${role === "batting" ? "batterId" : "pitcherId"} AS playerId,${key} AS key,${paCountFields.join(",")} FROM source WHERE ${where}`);
  }).join(" UNION ALL ");
  const splitRows = await client.execute({ sql: `WITH source AS (SELECT ${columns} FROM mlb_historical_plate_appearances NOT INDEXED WHERE season=?),
    expanded AS (${union}) SELECT playerId,role,key,${sumColumns} FROM expanded GROUP BY playerId,role,key`, args: [season] }); selects++;
  const splits = splitRows.rows.map(row => ({ playerId: String(row.playerId), role: String(row.role) as "batting" | "pitching", key: String(row.key), counts: counts(row) }));
  for (const split of splits) {
    const key = `${split.playerId}|${split.role}|${split.key}`, existing = rangeSplits.get(key);
    if (existing) add(existing.counts, split.counts); else rangeSplits.set(key, { ...split, counts: { ...split.counts } });
  }
  await publish(String(season), pairs, splits);
  if (competition === "postseason") {
    const path = join(root, `hub/${season}.json.gz`);
    const hub = JSON.parse(gunzipSync(await readFile(path)).toString("utf8"));
    await json(`hub/${season}.json`, { ...hub, analysis: { status: gate.directBvp === "ready" && gate.situations === "ready" ? "available" : "not_ready", reason: gate.directBvp === "ready" && gate.situations === "ready" ? null : "PA validation gate pending" } });
  }
}
await publish("range", rangePairs.values(), rangeSplits.values());
const manifestPath = join(root, "manifest.json.gz"), manifest = JSON.parse(gunzipSync(await readFile(manifestPath)).toString("utf8"));
await json("manifest.json", { ...manifest, features: { ...manifest.features, directBvp: gate.directBvp === "ready" ? "available" : "unavailable",
  situationalAnalysis: gate.situations === "ready" ? "available" : "unavailable", timesThroughOrder: "evaluate", count: "evaluate" } });
await json("advanced/capabilities.json", { schemaVersion: 1, league: "MLB", ...gate, scope: `${expectedSeasons[0]}–${expectedSeasons.at(-1)}`, rawPaPublic: false,
  unknownContexts: validation.seasons.map((s: { season: number; unknownStartContexts: number }) => ({ season: s.season, pa: s.unknownStartContexts })),
  timesThroughOrder: "evaluate", count: "evaluate", statcast: "unavailable" });
const files = await readdir(join(root, "advanced"));
const dbSize = (await stat(get("--db", ".data/mlb-historical.sqlite"))).size;
console.log(JSON.stringify({ gate, selects, dbWrites: 0, aggregationMs: Math.round(performance.now() - started), payloadBytes, largestPayload, payloadFiles, dbSize, scopes: files }));
client.close();
