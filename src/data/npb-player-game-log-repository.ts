import type { DataClient } from "./database";
import { battingFact, pitchingFact } from "./npb-repository";
import { gameContext, playerGameLogResponseSchema, type PlayerGameLogResponse } from "../domain/player-game-log";

type Row = Record<string, unknown>;
function context(row: Row, teamId: string, opponentTeamId: string | null) {
  return gameContext({ gameId: String(row.game_id), date: String(row.game_date),
    gameNumber: Number(row.game_number), status: String(row.status),
    homeTeamId: String(row.home_team_id), awayTeamId: String(row.away_team_id),
    homeScore: row.home_score === null ? null : Number(row.home_score),
    awayScore: row.away_score === null ? null : Number(row.away_score) }, teamId, opponentTeamId);
}

// Exactly three SELECTs for a known Player: Master existence, Batting+Game and Pitching+Game.
// The API does not expose source IDs, URLs or raw ingestion records.
export class NpbPlayerGameLogRepository {
  constructor(private readonly client: DataClient) {}

  async find(playerId: string, limit = 10, offset = 0): Promise<PlayerGameLogResponse | null> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(offset) || offset < 0)
      throw new Error("Invalid Game Log pagination");
    const master = await this.client.execute({ sql: `SELECT 1 FROM master_history
      WHERE entity_kind='player' AND entity_id=? LIMIT 1`, args: [playerId] });
    if (!master.rows.length) return null;
    const selectGame = `g.game_date,g.game_number,g.status,g.home_team_id,g.away_team_id,g.home_score,g.away_score`;
    const order = `ORDER BY g.game_date DESC,COALESCE(g.scheduled_time,'') DESC,g.game_number DESC,g.game_id DESC LIMIT ? OFFSET ?`;
    const [battingRows, pitchingRows] = await Promise.all([
      this.client.execute({ sql: `SELECT b.*,${selectGame} FROM player_game_batting b
        JOIN npb_games g ON g.game_id=b.game_id WHERE b.player_id=? ${order}`,
      args: [playerId, limit, offset] }),
      this.client.execute({ sql: `SELECT p.*,${selectGame} FROM player_game_pitching p
        JOIN npb_games g ON g.game_id=p.game_id WHERE p.player_id=? ${order}`,
      args: [playerId, limit, offset] }),
    ]);
    const batting = battingRows.rows.map((row) => {
      const fact = battingFact(row);
      return { ...context(row, fact.teamId, fact.opponentTeamId), battingOrder: fact.battingOrder,
        starter: fact.starter ?? null, pa: fact.pa, ab: fact.ab, runs: fact.runs ?? null,
        hits: fact.hits, doubles: fact.doubles, triples: fact.triples, homeRuns: fact.homeRuns,
        rbi: fact.rbi, walks: fact.walks, hbp: fact.hbp, sacrificeHits: fact.sacrificeHits ?? null,
        sacrificeFlies: fact.sacrificeFlies ?? null, strikeouts: fact.strikeouts,
        stolenBases: fact.stolenBases, caughtStealing: fact.caughtStealing };
    });
    const pitching = pitchingRows.rows.map((row) => {
      const fact = pitchingFact(row);
      return { ...context(row, fact.teamId, fact.opponentTeamId), role: fact.role,
        starter: fact.starter ?? null, appearanceOrder: fact.appearanceOrder,
        outsRecorded: fact.inningsPitchedOuts, battersFaced: fact.battersFaced,
        hits: fact.hits, homeRuns: fact.homeRuns, strikeouts: fact.strikeouts,
        runs: fact.runs, earnedRuns: fact.earnedRuns, pitchCount: fact.pitches,
        walksAndHitByPitch: fact.walksAndHitBatters ?? null, decision: fact.decision ?? null };
    });
    return playerGameLogResponseSchema.parse({ playerId, limit, offset, batting, pitching });
  }
}
