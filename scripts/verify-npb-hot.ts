import type { InStatement } from "@libsql/client";
import { openDataClient, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { PlayerPeriodBatchService } from "../src/application/player-period-batch";
import { evaluateHotCandidates } from "../src/application/npb-hot-candidates";

const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
if (process.argv.includes("--require-remote") && url.startsWith("file:"))
  throw new Error("A remote read-only verification connection is required");
const source = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
let queries = 0;
const client = new Proxy(source, { get(target, property) {
  if (property === "execute") return async (statement: string | InStatement) => {
    const sql = typeof statement === "string" ? statement : statement.sql;
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error("HOT diagnostic attempted a non-read SQL statement");
    queries += 1;
    return target.execute(statement);
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
  queries = 0;
  const batch = await new PlayerPeriodBatchService(repository, new NpbPeriodCoverageRepository(client))
    .aggregate({ asOfDate, period: "7d" });
  const batchQueries = queries;
  const hot = evaluateHotCandidates(batch);
  const hotQueries = queries - batchQueries;
  const after = await counts();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Protected Fact/mapping counts changed");
  const reasons = Object.fromEntries([...new Set(hot.candidates.flatMap((row) => row.eligibilityReasons))]
    .map((reason) => [reason, hot.candidates.filter((row) => row.eligibilityReasons.includes(reason)).length]));
  process.stdout.write(`${JSON.stringify({ database: url.startsWith("file:") ? "local" : "remote",
    asOfDate, from: hot.from, to: hot.to, batch: batch.summary,
    candidateCount: hot.candidates.length, coverageComplete: hot.coverageComplete,
    eligibleCounts: hot.eligibleCounts, exclusionReasons: reasons, productionGate: hot.productionGate,
    queryCounts: { batch: batchQueries, hot: hotQueries },
    before, after }, null, 2)}\n`);
} finally { source.close(); }
