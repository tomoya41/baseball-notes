import type { InStatement } from "@libsql/client";
import { join } from "node:path";
import { PlayerPeriodBatchService } from "../src/application/player-period-batch";
import { buildNpbHotPayload } from "../src/application/npb-hot-payload";
import type { HotCandidateMetadata } from "../src/application/npb-hot-candidates";
import { openDataClient, type DataClient } from "../src/data/database";
import { inspectLatestScheduledAction } from "../src/data/npb-freshness";
import { writeNpbHotPayloadAtomically } from "../src/data/npb-hot-payload";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { NpbRepository } from "../src/data/npb-repository";

function option(name: string): string | null {
  const argument = process.argv.find((value) => value.startsWith(`${name}=`));
  return argument?.slice(name.length + 1) ?? null;
}

const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
if (process.argv.includes("--require-remote") && url.startsWith("file:"))
  throw new Error("HOT publishing requires the configured remote database");
const source = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
let queryCount = 0;
const client = new Proxy(source, { get(target, property) {
  if (property === "execute") return async (statement: string | InStatement) => {
    const sql = typeof statement === "string" ? statement : statement.sql;
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error("HOT publish attempted a non-read SQL statement");
    queryCount += 1;
    return target.execute(statement);
  };
  const value: unknown = Reflect.get(target, property);
  return typeof value === "function" ? value.bind(target) : value;
} }) as DataClient;

async function protectedCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of ["player_game_batting", "player_game_pitching", "npb_games", "source_entity_mappings"])
    counts[table] = Number((await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]?.n ?? 0);
  return counts;
}

async function displayMetadata(repository: NpbRepository): Promise<Map<string, HotCandidateMetadata>> {
  const teams = new Map((await repository.findTeams()).map((team) => [team.id, team]));
  const rows = await client.execute(`SELECT entity_id,payload_json FROM
    (SELECT entity_id,payload_json,ROW_NUMBER() OVER
      (PARTITION BY entity_id ORDER BY valid_from DESC) AS ordinal
      FROM master_history WHERE entity_kind='player') WHERE ordinal=1`);
  const metadata = new Map<string, HotCandidateMetadata>();
  for (const row of rows.rows) {
    const value = JSON.parse(String(row.payload_json)) as { name?: unknown; teamId?: unknown };
    const teamId = typeof value.teamId === "string" ? value.teamId : null;
    const team = teamId ? teams.get(teamId) : undefined;
    if (typeof value.name !== "string" || !value.name.trim() || !teamId || !team) continue;
    metadata.set(String(row.entity_id), { displayName: value.name, teamId,
      teamName: team.names.japaneseShort ?? team.names.canonical });
  }
  return metadata;
}

try {
  const before = await protectedCounts();
  const repository = new NpbRepository(client);
  const asOfDate = option("--date") ?? (await repository.findLatestStandings())[0]?.date;
  if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate))
    throw new Error("A valid completed JST date is required");
  const started = performance.now();
  const batch = await new PlayerPeriodBatchService(repository, new NpbPeriodCoverageRepository(client))
    .aggregate({ asOfDate, period: "7d" });
  const metadata = await displayMetadata(repository);
  const scheduled = await client.execute({ sql: `SELECT 1 FROM npb_day_runs
    WHERE target_date=? AND trigger_kind='scheduled' AND day_status='complete'
      AND operational_status='succeeded' AND backup_status='exported' LIMIT 1`, args: [asOfDate] });
  let scheduledProductionEvidence = false;
  if (scheduled.rows.length) {
    try {
      const action = await inspectLatestScheduledAction("tomoya41/baseball-notes");
      scheduledProductionEvidence = action?.conclusion === "success" &&
        action.inferredTargetDate === asOfDate && action.encryptedBackupArtifact === "present";
    } catch { /* A failed operational proof closes the HOT gate; it never opens it. */ }
  }
  const { payload } = buildNpbHotPayload(batch, { scheduledProductionEvidence,
    metadata });
  const path = join(option("--payload-root") ?? ".data/publish", "data", "npb", "hot", "latest.json");
  const bytes = await writeNpbHotPayloadAtomically(path, payload);
  const after = await protectedCounts();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Protected Fact counts changed");
  process.stdout.write(`${JSON.stringify({ effectiveDate: payload.effectiveDate, period: payload.period,
    readiness: payload.readiness, coverage: payload.coverage, entries: {
      batting: payload.batting.length, starters: payload.starters.length, relievers: payload.relievers.length },
    bytes, queryCount, durationMs: Math.round(performance.now() - started), protectedCountsUnchanged: true })}\n`);
} finally { source.close(); }
