import { openDataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { PlayerPeriodService } from "../src/application/player-period";
import { resolvePlayerPeriod } from "../src/domain/player-period";

const asOfDate = process.argv.find((arg) => arg.startsWith("--date="))?.slice(7) ?? "2026-09-24";
const periods = ["7d", "14d", "30d"] as const;
const window = resolvePlayerPeriod({ playerId: "selection", asOfDate, period: "30d" });
const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
const client = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
const tables = ["player_game_batting", "player_game_pitching", "npb_games", "source_entity_mappings"] as const;
async function counts() {
  const result: Record<string, number> = {};
  for (const table of tables)
    result[table] = Number((await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]?.n ?? 0);
  return result;
}
async function choose(table: "player_game_batting" | "player_game_pitching"): Promise<string> {
  const rows = await client.execute({ sql: `SELECT f.player_id,COUNT(DISTINCT f.game_id) AS games
    FROM ${table} f JOIN npb_games g ON g.game_id=f.game_id
    WHERE g.game_date BETWEEN ? AND ? GROUP BY f.player_id ORDER BY games DESC,f.player_id LIMIT 1`, args: [window.from, window.to] });
  if (!rows.rows[0]) throw new Error(`No ${table} facts in ${window.from}..${window.to}`);
  return String(rows.rows[0].player_id);
}
async function name(playerId: string): Promise<string> {
  const rows = await client.execute({ sql: `SELECT payload_json FROM master_history
    WHERE entity_kind='player' AND entity_id=? ORDER BY valid_from DESC LIMIT 1`, args: [playerId] });
  if (!rows.rows[0]) return playerId;
  const payload = JSON.parse(String(rows.rows[0].payload_json)) as { name?: string };
  return payload.name ?? playerId;
}

try {
  const before = await counts();
  const repository = new NpbRepository(client);
  const service = new PlayerPeriodService(repository, () => new Date(), new NpbPeriodCoverageRepository(client));
  const batterId = process.argv.find((arg) => arg.startsWith("--batter="))?.slice(9) ?? await choose("player_game_batting");
  const pitcherId = process.argv.find((arg) => arg.startsWith("--pitcher="))?.slice(10) ?? await choose("player_game_pitching");
  const battingFacts = await repository.findBattingByPlayer(batterId, window.from, window.to);
  const pitchingFacts = await repository.findPitchingByPlayer(pitcherId, window.from, window.to);
  const batting = Object.fromEntries(await Promise.all(periods.map(async (period) =>
    [period, await service.batting({ playerId: batterId, asOfDate, period })] as const)));
  const pitching = Object.fromEntries(await Promise.all(periods.map(async (period) =>
    [period, await service.pitching({ playerId: pitcherId, asOfDate, period })] as const)));
  const after = await counts();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Fact/mapping row counts changed during read-only verification");
  process.stdout.write(`${JSON.stringify({ database: url.startsWith("file:") ? "local" : "remote", window,
    before, after, batter: { name: await name(batterId), playerId: batterId, facts: battingFacts, result: batting },
    pitcher: { name: await name(pitcherId), playerId: pitcherId, facts: pitchingFacts, result: pitching } }, null, 2)}\n`);
} finally { client.close(); }
