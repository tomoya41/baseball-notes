import type { InStatement } from "@libsql/client";
import { openDataClient, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { PlayerPeriodService } from "../src/application/player-period";
import { PlayerPeriodBatchService } from "../src/application/player-period-batch";

const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
if (process.argv.includes("--require-remote") && url.startsWith("file:"))
  throw new Error("A remote read-only verification connection is required");
const source = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
let queries = 0;
let sqlReadMs = 0;
const client = new Proxy(source, { get(target, property) {
  if (property === "execute") return async (statement: string | InStatement) => {
    const sql = typeof statement === "string" ? statement : statement.sql;
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error("Batch verification attempted a non-read SQL statement");
    const started = performance.now();
    const result = await target.execute(statement);
    queries += 1;
    sqlReadMs += performance.now() - started;
    return result;
  };
  const value: unknown = Reflect.get(target, property);
  return typeof value === "function" ? value.bind(target) : value;
} }) as DataClient;
const tables = ["player_game_batting", "player_game_pitching", "npb_games", "source_entity_mappings"] as const;
async function counts(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of tables)
    result[table] = Number((await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]?.n ?? 0);
  return result;
}

try {
  const before = await counts();
  const repository = new NpbRepository(client);
  const asOfDate = process.argv.find((arg) => arg.startsWith("--date="))?.slice(7) ??
    (await repository.findLatestStandings())[0]?.date;
  if (!asOfDate) throw new Error("A validated as-of date is required");
  const coverage = new NpbPeriodCoverageRepository(client);
  const fixedClock = () => new Date("2026-09-25T00:00:00Z");
  const batch = new PlayerPeriodBatchService(repository, coverage, fixedClock);
  const individual = new PlayerPeriodService(repository, fixedClock, coverage);
  const stageInputs: { name: string; period: "7d" | "14d" | "30d"; maxBatters?: number; maxPitchers?: number }[] = [
    { name: "A_batters10", period: "7d", maxBatters: 10, maxPitchers: 0 },
    { name: "B_pitchers10", period: "7d", maxBatters: 0, maxPitchers: 10 },
    { name: "C_each50", period: "7d", maxBatters: 50, maxPitchers: 50 },
    { name: "D_all7d", period: "7d" },
    { name: "D_all14d", period: "14d" },
    { name: "D_all30d", period: "30d" },
  ];
  const stages = [];
  const consistency = [];
  for (const input of stageInputs) {
    queries = 0; sqlReadMs = 0;
    const heapBefore = process.memoryUsage().heapUsed;
    const result = await batch.aggregate({ asOfDate, period: input.period,
      maxBatters: input.maxBatters, maxPitchers: input.maxPitchers });
    stages.push({ stage: input.name, period: input.period, ...result.summary,
      queryCount: queries, sqlReadMs: Math.round(sqlReadMs),
      dbReadMs: Math.round(result.timings.dbReadMs), aggregationMs: Math.round(result.timings.aggregationMs),
      totalMs: Math.round(result.timings.totalMs), heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore });
    if (!input.name.startsWith("D_")) continue;
    for (const [role, playerId] of [["batter", "06a3e027-7a73-4792-9c91-8ecc3c1da36a"],
      ["pitcher", "6bf4b271-e16c-43f9-9142-8c7ca7de9887"]] as const) {
      const actual = role === "batter" ? result.batters.find((row) => row.playerId === playerId) :
        result.pitchers.find((row) => row.playerId === playerId);
      if (!actual) {
        if (!url.startsWith("file:") && asOfDate === "2026-09-24")
          throw new Error(`${role} known player missing from the 2026-09-24 batch`);
        consistency.push({ role, period: input.period, present: false });
        continue;
      }
      const expected = role === "batter" ? await individual.batting({ playerId, asOfDate, period: input.period }) :
        await individual.pitching({ playerId, asOfDate, period: input.period });
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${role} individual/batch mismatch for ${input.period}`);
      if (role === "pitcher" && actual.metrics.WHIP.status !== "unavailable")
        throw new Error("NPB WHIP must remain unavailable without standalone BB");
      consistency.push({ role, period: input.period, present: true, matches: true });
    }
  }
  const after = await counts();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Protected Fact/mapping counts changed");
  process.stdout.write(`${JSON.stringify({ database: url.startsWith("file:") ? "local" : "remote", asOfDate,
    before, after, stages, consistency }, null, 2)}\n`);
} finally { source.close(); }
