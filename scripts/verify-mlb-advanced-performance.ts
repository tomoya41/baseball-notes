import { writeFile } from "node:fs/promises";
import { openDataClient } from "../src/data/database";
import { paCountFields, type PaCounts, type HistoricalPlateAppearance } from "../src/domain/mlb-plate-appearance";
import { paAnalysisMetrics } from "../src/domain/mlb-pa-analysis";

const args = process.argv.slice(2), get = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1] ?? fallback : fallback;
const db = openDataClient(`file:${get("--db", ".data/mlb-historical.sqlite")}`);
const selection = await db.execute("SELECT player_id,payload_json FROM mlb_historical_players WHERE json_extract(payload_json,'$.name')='Shohei Ohtani'");
const batterId = String(selection.rows[0]?.player_id);
const pair = await db.execute({ sql: "SELECT pitcherId,COUNT(*) AS n FROM mlb_historical_plate_appearances WHERE batterId=? GROUP BY pitcherId ORDER BY n DESC,pitcherId LIMIT 1", args: [batterId] });
const pitcherId = String(pair.rows[0]?.pitcherId);
const pitcher = await db.execute({ sql: "SELECT payload_json FROM mlb_historical_players WHERE player_id=?", args: [pitcherId] });
const sum = `COUNT(*) AS PA,${paCountFields.map(field => `SUM(${field}) AS ${field}`).join(",")}`;
const tests = [
  { name: "one_matchup", sql: `SELECT ${sum} FROM mlb_historical_plate_appearances WHERE batterId=? AND pitcherId=?`, args: [batterId, pitcherId] },
  { name: "batter_opponents", sql: `SELECT pitcherId,${sum} FROM mlb_historical_plate_appearances WHERE batterId=? GROUP BY pitcherId`, args: [batterId] },
  { name: "pitcher_opponents", sql: `SELECT batterId,${sum} FROM mlb_historical_plate_appearances WHERE pitcherId=? GROUP BY batterId`, args: [pitcherId] },
  { name: "situational_outs", sql: `SELECT outsBefore,${sum} FROM mlb_historical_plate_appearances WHERE batterId=? AND outsBefore IS NOT NULL GROUP BY outsBefore`, args: [batterId] },
];
const report = [];
for (const test of tests) {
  const plan = await db.execute({ sql: `EXPLAIN QUERY PLAN ${test.sql}`, args: test.args });
  const started = performance.now(); const result = await db.execute({ sql: test.sql, args: test.args });
  const readMs = performance.now() - started, aggregationAt = performance.now();
  const payload = result.rows.map(row => ({ ...row, metrics: paAnalysisMetrics(Object.fromEntries(["PA", ...paCountFields]
    .map(field => [field, Number(row[field] ?? 0)])) as PaCounts) }));
  const aggregationMs = performance.now() - aggregationAt, serialized = JSON.stringify(payload);
  report.push({ name: test.name, selects: 1, readMs, aggregationMs, totalMs: performance.now() - started,
    bytes: Buffer.byteLength(serialized), resultRows: result.rows.length, rowsScanned: null, plan: plan.rows.map(row => row.detail),
    representative: test.name === "one_matchup" ? payload : undefined });
}
// Times-through-lineup-slot PoC, restricted to a source-designated starter. This
// remains internal: it is not claimed as a universal official TTO convention.
const game = await db.execute("SELECT payload_json FROM mlb_historical_games WHERE season=2025 ORDER BY game_date,game_id LIMIT 1");
const parsed = JSON.parse(String(game.rows[0]?.payload_json));
const starterIds = new Set(parsed.pitching.filter((row: { role: string }) => row.role === "starter").map((row: { playerId: string }) => row.playerId));
const rows = await db.execute({ sql: "SELECT * FROM mlb_historical_plate_appearances WHERE gameId=? ORDER BY sequence", args: [parsed.id] });
const visits = new Map<string, number>(), groups: Record<string, number> = { first: 0, second: 0, thirdPlus: 0, unknown: 0 };
for (const row of rows.rows as unknown as HistoricalPlateAppearance[]) {
  if (!starterIds.has(row.pitcherId)) continue;
  if (row.battingOrder === null) { groups.unknown!++; continue; }
  const key = `${row.pitcherId}:${row.battingOrder}`, count = (visits.get(key) ?? 0) + 1; visits.set(key, count);
  groups[count === 1 ? "first" : count === 2 ? "second" : "thirdPlus"]!++;
}
let indexBytes: unknown = null;
try { indexBytes = (await db.execute("SELECT name,SUM(pgsize) AS bytes FROM dbstat WHERE name LIKE 'mlb_pa_%' GROUP BY name")).rows; } catch { /* SQLite build may omit dbstat. */ }
const output = { batter: "Shohei Ohtani", batterId, pitcher: JSON.parse(String(pitcher.rows[0]?.payload_json)).name, pitcherId,
  report, ttoPoc: { gameId: parsed.id, groups, production: false, reason: "slot-visits proof only; no public TTO convention is asserted" }, indexBytes };
await writeFile(get("--report", ".data/mlb-advanced-performance.json"), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output)); db.close();
