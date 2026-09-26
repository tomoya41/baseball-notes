import type { InStatement } from "@libsql/client";
import { openDataClient, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { PlayerAnalysisBundleService } from "../src/application/player-analysis-bundle";
import { resolvePlayerPeriod } from "../src/domain/player-period";

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!url || !token || url.startsWith("file:")) throw new Error("Remote read-only Turso connection required");
const source = openDataClient(url, token);
let queries = 0;
const client = new Proxy(source, { get(target, property) {
  if (property === "execute") return async (statement: string | InStatement) => {
    const sql = typeof statement === "string" ? statement : statement.sql;
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error("Analysis verification attempted non-read SQL");
    queries++;
    return target.execute(statement);
  };
  const value: unknown = Reflect.get(target, property);
  return typeof value === "function" ? value.bind(target) : value;
} }) as DataClient;

try {
  const repository = new NpbRepository(client);
  const asOfDate = process.argv.find((arg) => arg.startsWith("--date="))?.slice(7) ??
    (await repository.findLatestStandings())[0]?.date;
  if (!asOfDate) throw new Error("A validated as-of date is required");
  const { from, to } = resolvePlayerPeriod({ playerId: "diagnostic", asOfDate, period: "30d" });
  const countRows = await client.execute({ sql: `SELECT b.batting_order AS batting_order,COUNT(*) AS n FROM player_game_batting b
    JOIN npb_games g ON g.game_id=b.game_id WHERE g.game_date BETWEEN ? AND ?
    GROUP BY b.batting_order ORDER BY b.batting_order`, args: [from, to] });
  const byOrder = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, 0]));
  let unknown = 0;
  for (const row of countRows.rows) {
    const order = row.batting_order;
    if (typeof order === "number" && Number.isInteger(order) && order >= 1 && order <= 9)
      byOrder[order] = Number(row.n);
    else unknown += Number(row.n);
  }
  const known = Object.values(byOrder).reduce((sum, value) => sum + value, 0);
  const multi = await client.execute({ sql: `SELECT b.player_id,COUNT(DISTINCT b.batting_order) AS orders
    FROM player_game_batting b JOIN npb_games g ON g.game_id=b.game_id
    WHERE g.game_date BETWEEN ? AND ? AND b.batting_order BETWEEN 1 AND 9
    GROUP BY b.player_id HAVING COUNT(DISTINCT b.batting_order)>1 ORDER BY orders DESC,b.player_id LIMIT 3`,
  args: [from, to] });
  console.log(JSON.stringify({ kind: "batting_order_coverage", asOfDate, from, to,
    total: known + unknown, known, unknown, knownRate: known + unknown ? known / (known + unknown) : 0,
    byOrder, multiOrderPlayerIds: multi.rows.map((row) => String(row.player_id)) }));
  const selected = ["06a3e027-7a73-4792-9c91-8ecc3c1da36a", "2d760a27-b58a-47a5-80df-6b0aa3571ef5",
    "a1ca7cac-f9be-4993-a78c-bcd1e1ae3399", "6bf4b271-e16c-43f9-9142-8c7ca7de9887",
    "a66dfd52-1ae2-4245-b849-558f263e6422", ...multi.rows.map((row) => String(row.player_id))];
  for (const playerId of new Set(selected)) {
    const before = queries;
    const result = await new PlayerAnalysisBundleService(repository, new NpbPeriodCoverageRepository(client))
      .find(playerId, asOfDate);
    if (!result) continue;
    const { payload } = result;
    const section = payload.battingOrder.status === "ready" ? payload.battingOrder.payload : null;
    console.log(JSON.stringify({ kind: "player_analysis", playerId, name: result.context.player.name,
      queryCount: queries - before, battingFactRows: result.context.batting.length,
      pitchingFactRows: result.context.pitching.length, dbReadMs: Math.round(result.dbReadMs),
      partitionAndAggregateMs: Math.round(result.aggregationMs), responseBytes: Buffer.byteLength(JSON.stringify(payload)),
      sections: { comparison: payload.comparison.status, homeAway: payload.homeAway.status,
        opponent: payload.opponent.status, battingOrder: payload.battingOrder.status },
      orders: section?.orders.map((item) => ({ order: item.battingOrder, games: item.stats?.metrics.G?.value,
        pa: item.stats?.metrics.PA?.value, ab: item.stats?.metrics.AB?.value,
        bb: item.stats?.metrics.BB?.value, ops: item.stats?.metrics.OPS?.value })) ?? [],
      unknownFactCount: section?.unknownBattingOrderFactCount ?? null,
      unknownPa: section?.unknownBattingOrderPa ?? null,
      classifiedPa: section?.classifiedTotal?.metrics.PA?.value ?? null }));
  }
} finally { source.close(); }
