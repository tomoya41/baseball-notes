import type { DataClient } from "./database";
import { battingFact, pitchingFact } from "./npb-repository";
import { aggregateBatting, aggregatePitching, type AggregateMetric } from "../domain/player-period";
import { npbTeamSeasonSchema } from "../domain/npb-product-contract";
import type { NpbCatalog } from "../domain/npb-product-contract";
import type { PeriodCoverage } from "../domain/period-coverage";
import { seasonBattingKeys, seasonPitchingKeys } from "../application/npb-season-payload";

// Three batch SELECTs, independent of the number of teams/players/splits; no persistent derived table.
export async function readNpbTeamSeason(client: DataClient, catalog: NpbCatalog, coverage: PeriodCoverage) {
  const args = [coverage.from, coverage.to];
  const [games, batting, pitching] = await Promise.all([
    client.execute({ sql: "SELECT game_id,home_team_id,away_team_id,home_score,away_score,venue FROM npb_games WHERE status='final' AND game_date BETWEEN ? AND ?", args }),
    client.execute({ sql: "SELECT b.* FROM player_game_batting b JOIN npb_games g ON g.game_id=b.game_id WHERE g.status='final' AND g.game_date BETWEEN ? AND ?", args }),
    client.execute({ sql: "SELECT p.* FROM player_game_pitching p JOIN npb_games g ON g.game_id=p.game_id WHERE g.status='final' AND g.game_date BETWEEN ? AND ?", args }),
  ]);
  const bat = batting.rows.map(battingFact), pitch = pitching.rows.map(pitchingFact);
  const metric = (m: Record<string, AggregateMetric>, keys: readonly string[]) => Object.fromEntries(keys.map(k => [k, m[k]! ]));
  const teams = catalog.teams.map(t => {
    const rows = games.rows.filter(g => g.home_team_id === t.teamId || g.away_team_id === t.teamId);
    let W = 0, L = 0, T = 0, scored = 0, runsFor = 0, runsAgainst = 0;
    for (const g of rows) {
      if (g.home_score === null || g.away_score === null) continue;
      const home = g.home_team_id === t.teamId;
      const a = Number(home ? g.home_score : g.away_score), b = Number(home ? g.away_score : g.home_score);
      scored++; runsFor += a; runsAgainst += b;
      if (a > b) W++; else if (a < b) L++; else T++;
    }
    const b = bat.filter(f => f.teamId === t.teamId).map(f => ({ ...f, playerId: t.teamId }));
    const p = pitch.filter(f => f.teamId === t.teamId).map(f => ({ ...f, playerId: t.teamId }));
    const query = { playerId: t.teamId, period: "season", asOfDate: catalog.effectiveDate } as const;
    const window = { from: coverage.from, to: coverage.to, timeZone: "Asia/Tokyo" } as const;
    const now = new Date(catalog.generatedAt);
    return { teamId: t.teamId, G: rows.length, W, L, T, runsFor: scored === rows.length && scored > 0 ? runsFor : null,
      runsAgainst: scored === rows.length && scored > 0 ? runsAgainst : null,
      scoreStatus: !scored ? "unavailable" : scored === rows.length ? "complete" : "partial",
      gamesWithBattingFacts: new Set(b.map(f => f.gameId)).size, gamesWithPitchingFacts: new Set(p.map(f => f.gameId)).size,
      observedHomeVenues: [...new Set(rows.filter(g => g.home_team_id === t.teamId && typeof g.venue === "string" && g.venue)
        .map(g => String(g.venue)))].sort(),
      batting: metric(aggregateBatting(query, b, now, coverage, window).metrics, seasonBattingKeys),
      pitching: metric(aggregatePitching(query, p, now, coverage, window).metrics, seasonPitchingKeys) };
  });
  return npbTeamSeasonSchema.parse({ schemaVersion: 1, league: "NPB", season: Number(catalog.effectiveDate.slice(0, 4)),
    competition: "regular", scope: "stored_final_games", effectiveDate: catalog.effectiveDate, generatedAt: catalog.generatedAt,
    period: { from: coverage.from, to: coverage.to }, coverage: { status: coverage.status, summary: coverage.summary }, teams });
}
