import type { DataClient } from "./database";
import { NpbRepository, situatedBattingFact } from "./npb-repository";
import { battingLine, npbGameDetailSchema, pitchingLine, sumKnown, type NpbGameDetail } from "../domain/npb-game-detail";
import { gameContext } from "../domain/player-game-log";

// Six fixed SELECTs for an existing Game; no per-player or per-team lookups.
export class NpbGameDetailRepository {
  constructor(private readonly client: DataClient) {}

  async find(gameId: string): Promise<{ payload: NpbGameDetail; projectionMs: number; battingRows: number; pitchingRows: number } | null> {
    const gameRows = await this.client.execute({ sql: `SELECT game_id,game_date,game_number,status,
      home_team_id,away_team_id,home_score,away_score FROM npb_games WHERE game_id=?`, args: [gameId] });
    const game = gameRows.rows[0];
    if (!game) return null;
    const repository = new NpbRepository(this.client);
    const [battingRows, pitchingFacts, completeness, teams, playerRows] = await Promise.all([
      this.client.execute({ sql: "SELECT * FROM player_game_batting WHERE game_id=?", args: [gameId] }),
      repository.findPitchingByGame(gameId),
      repository.findGameCompleteness(gameId), repository.findTeams(),
      this.client.execute({ sql: `SELECT entity_id,payload_json FROM master_history WHERE entity_kind='player'
        AND entity_id IN (SELECT player_id FROM player_game_batting WHERE game_id=?
          UNION SELECT player_id FROM player_game_pitching WHERE game_id=?)
        ORDER BY valid_from DESC`, args: [gameId, gameId] }),
    ]);
    const start = performance.now();
    const battingFacts = battingRows.rows.map(situatedBattingFact);
    const homeId = String(game.home_team_id), awayId = String(game.away_team_id);
    if (homeId === awayId) throw new Error("Game teams must differ");
    const names = new Map<string, string>();
    for (const row of playerRows.rows) {
      const id = String(row.entity_id);
      if (names.has(id)) continue;
      const payload = JSON.parse(String(row.payload_json)) as { name?: unknown };
      if (typeof payload.name === "string" && payload.name.trim()) names.set(id, payload.name);
    }
    const teamName = (id: string) => {
      const team = teams.find((item) => item.id === id);
      return { id, name: team?.names.japaneseFull ?? team?.names.canonical ?? "球団名未登録",
        shortName: team?.names.japaneseShort ?? team?.names.canonical ?? "球団名未登録" };
    };
    const side = (id: string) => {
      if (id === homeId) return "home";
      if (id === awayId) return "away";
      throw new Error("Fact team does not belong to Game");
    };
    const batting = { home: [] as ReturnType<typeof battingLine>[], away: [] as ReturnType<typeof battingLine>[] };
    const pitching = { home: [] as ReturnType<typeof pitchingLine>[], away: [] as ReturnType<typeof pitchingLine>[] };
    const gameContextRow = { gameId, date: String(game.game_date), gameNumber: Number(game.game_number),
      status: String(game.status), homeTeamId: homeId, awayTeamId: awayId,
      homeScore: game.home_score === null ? null : Number(game.home_score),
      awayScore: game.away_score === null ? null : Number(game.away_score) };
    for (const fact of battingFacts) {
      gameContext(gameContextRow, fact.teamId, fact.opponentTeamId);
      batting[side(fact.teamId)].push(battingLine(fact, names.get(fact.playerId) ?? "選手名未登録"));
    }
    for (const fact of pitchingFacts) {
      gameContext(gameContextRow, fact.teamId, fact.opponentTeamId);
      pitching[side(fact.teamId)].push(pitchingLine(fact, names.get(fact.playerId) ?? "選手名未登録"));
    }
    for (const key of ["home", "away"] as const) {
      batting[key].sort((a, b) => (a.battingOrder ?? 10) - (b.battingOrder ?? 10) ||
        Number(b.starter === true) - Number(a.starter === true) || a.playerId.localeCompare(b.playerId));
      pitching[key].sort((a, b) => (a.appearanceOrder ?? 999) - (b.appearanceOrder ?? 999) ||
        Number(b.role === "starter") - Number(a.role === "starter") || a.playerId.localeCompare(b.playerId));
    }
    const team = (key: "home" | "away") => {
      const id = key === "home" ? homeId : awayId;
      const rows = batting[key];
      return { ...teamName(id), score: game[key === "home" ? "home_score" : "away_score"] === null ? null :
        Number(game[key === "home" ? "home_score" : "away_score"]),
      totals: { pa: sumKnown(rows.map((row) => row.pa)), ab: sumKnown(rows.map((row) => row.ab)),
        runs: sumKnown(rows.map((row) => row.runs)), hits: sumKnown(rows.map((row) => row.hits)),
        homeRuns: sumKnown(rows.map((row) => row.homeRuns)) } };
    };
    const payload = npbGameDetailSchema.parse({ gameId, date: String(game.game_date),
      gameNumber: Number(game.game_number), status: game.status, completeness: completeness?.gameStatus ?? null,
      home: team("home"), away: team("away"), batting, pitching });
    return { payload, projectionMs: performance.now() - start, battingRows: battingFacts.length,
      pitchingRows: pitchingFacts.length };
  }
}
