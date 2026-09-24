import { createHash, randomUUID } from "node:crypto";
import type { InStatement } from "@libsql/client";
import type { DataClient } from "./database";
import type { Standing } from "../domain/standings";
import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../domain/game-facts";
import { teamSchema, type Team } from "../domain/models";
import { npbTeams, type NpbGame, type NpbLogRow } from "./npb-nf3";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class NpbRepository {
  constructor(private readonly client: DataClient) {}

  async syncTeamMappings(at: string): Promise<void> {
    const statements: InStatement[] = [];
    for (const mapping of npbTeams) {
      const team = teamSchema.parse({ id: mapping.id, league: "NPB", names: {
        canonical: mapping.name, japaneseFull: mapping.name, japaneseShort: mapping.short, abbreviation: mapping.code,
      } });
      statements.push({ sql: `INSERT INTO source_entity_mappings VALUES ('nf3','team',?,?,?,?,?)
        ON CONFLICT(source_key,entity_kind,source_entity_id) DO UPDATE SET last_seen=excluded.last_seen`,
        args: [mapping.code,team.id,"https://nf3.sakura.ne.jp/",at,at] });
      statements.push({ sql: `INSERT INTO master_history (entity_kind,entity_id,valid_from,payload_json,source_key,source_record_id,collected_at)
        VALUES ('team',?, '2026-01-01', ?, 'nf3', ?, ?)
        ON CONFLICT(entity_kind,entity_id,valid_from) DO UPDATE SET payload_json=excluded.payload_json,collected_at=excluded.collected_at`,
        args: [team.id,JSON.stringify(team),mapping.code,at] });
    }
    await this.client.batch(statements,"write");
  }

  async findTeams(): Promise<Team[]> {
    const result = await this.client.execute("SELECT payload_json FROM master_history WHERE entity_kind='team' AND source_key='nf3' AND valid_from='2026-01-01'");
    return result.rows.map((row) => teamSchema.parse(JSON.parse(String(row.payload_json)) as unknown));
  }

  async resolveCuratedPlayer(sourceId: string, name: string, sourceUrl: string, teamId: string, at: string, dryRun: boolean): Promise<string> {
    const result = await this.client.execute({
      sql: "SELECT internal_entity_id FROM source_entity_mappings WHERE source_key='nf3' AND entity_kind='player' AND source_entity_id=?",
      args: [sourceId],
    });
    if (result.rows[0]) return String(result.rows[0].internal_entity_id);
    const id = randomUUID();
    if (!dryRun) await this.client.batch([
      { sql: "INSERT INTO source_entity_mappings VALUES ('nf3','player',?,?,?,?,?)", args: [sourceId, id, sourceUrl, at, at] },
      { sql: "INSERT INTO master_history (entity_kind,entity_id,valid_from,payload_json,source_key,source_record_id,collected_at) VALUES ('player',?,?,?,?,?,?)",
        args: [id, at.slice(0, 10), JSON.stringify({ name, teamId, sourceUrl }), "nf3", sourceId, at] },
    ], "write");
    return id;
  }

  async saveStandings(rows: readonly Standing[], dryRun: boolean): Promise<{ inserted: number; updated: number }> {
    if (rows.length !== 12) throw new Error("Incomplete standings snapshot");
    const date = rows[0]?.date;
    if (!date || rows.some((row) => row.date !== date)) throw new Error("Mixed standings dates");
    const prior = await this.client.execute({ sql: "SELECT COUNT(*) AS n FROM standings_daily WHERE league='NPB' AND snapshot_date=?", args: [date] });
    const existing = Number(prior.rows[0]?.n ?? 0);
    const statements: InStatement[] = rows.map((row) => ({
      sql: `INSERT INTO standings_daily (snapshot_date,season,league,competition_group,team_id,rank,wins,losses,ties,games_played,pct,games_behind_leader,streak,source_key,collected_at,calculated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(snapshot_date,league,competition_group,team_id) DO UPDATE SET
              rank=excluded.rank,wins=excluded.wins,losses=excluded.losses,ties=excluded.ties,
              games_played=excluded.games_played,pct=excluded.pct,games_behind_leader=excluded.games_behind_leader,
              streak=excluded.streak,collected_at=excluded.collected_at,calculated_at=excluded.calculated_at`,
      args: [row.date,row.season,row.league,row.competitionGroup,row.teamId,row.rank,row.wins,row.losses,row.ties,
        row.gamesPlayed,row.pct,row.gamesBehindLeader,row.streak,row.sourceKey,row.collectedAt,row.calculatedAt],
    }));
    statements.push(this.stageStatement(date, "standings", "complete", rows.length, null));
    if (!dryRun) await this.client.batch(statements, "write");
    return { inserted: existing === 0 ? 12 : 0, updated: existing === 0 ? 0 : 12 };
  }

  async findLatestStandings(): Promise<Standing[]> {
    const latest = await this.client.execute("SELECT MAX(snapshot_date) AS date FROM standings_daily WHERE league='NPB'");
    const date = latest.rows[0]?.date;
    return date ? this.findStandingsByDate(String(date)) : [];
  }
  async findStandingsByDate(date: string): Promise<Standing[]> {
    const rows = await this.client.execute({ sql: "SELECT * FROM standings_daily WHERE league='NPB' AND snapshot_date=? ORDER BY competition_group,rank", args: [date] });
    return rows.rows.map((row) => ({ date: String(row.snapshot_date), season: Number(row.season), league: "NPB" as const,
      competitionGroup: String(row.competition_group), teamId: String(row.team_id), rank: Number(row.rank),
      wins: Number(row.wins), losses: Number(row.losses), ties: Number(row.ties), gamesPlayed: Number(row.games_played),
      pct: Number(row.pct), gamesBehindLeader: Number(row.games_behind_leader), streak: Number(row.streak),
      sourceKey: String(row.source_key), collectedAt: String(row.collected_at), calculatedAt: String(row.calculated_at) }));
  }

  async findStageStatuses(date: string): Promise<Record<string, string>> {
    const result = await this.client.execute({ sql: "SELECT stage,status FROM npb_ingestion_stages WHERE target_date=?", args: [date] });
    return Object.fromEntries(result.rows.map((row) => [String(row.stage), String(row.status)]));
  }

  async saveGames(games: readonly NpbGame[], targetDate: string, dryRun: boolean, complete = true): Promise<{ inserted: number; updated: number; skipped: number }> {
    const ids = games.map((game) => game.id);
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate game identity");
    const statements: InStatement[] = [];
    let inserted = 0, updated = 0, skipped = 0;
    for (const game of games) {
      const old = await this.client.execute({ sql: "SELECT content_hash FROM npb_games WHERE game_id=?", args: [game.id] });
      const contentHash = hash([game.date,game.homeTeamId,game.awayTeamId,game.gameNumber,game.venue,game.scheduledTime,game.status,game.homeScore,game.awayScore]);
      if (old.rows[0]?.content_hash === contentHash) { skipped++; continue; }
      if (old.rows.length) updated++; else inserted++;
      statements.push({ sql: `INSERT INTO npb_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(game_id) DO UPDATE SET venue=excluded.venue,scheduled_time=excluded.scheduled_time,
          status=excluded.status,home_score=excluded.home_score,away_score=excluded.away_score,
          source_url=excluded.source_url,collected_at=excluded.collected_at,content_hash=excluded.content_hash`,
        args: [game.id,game.season,game.date,game.homeTeamId,game.awayTeamId,game.gameNumber,game.venue,
          game.scheduledTime,game.status,game.homeScore,game.awayScore,game.sourceKey,game.sourceRecordId,
          game.sourceUrl,game.collectedAt,contentHash] });
      statements.push({ sql: `INSERT INTO source_entity_mappings VALUES ('nf3','game',?,?,?,?,?)
        ON CONFLICT(source_key,entity_kind,source_entity_id) DO UPDATE SET last_seen=excluded.last_seen`,
        args: [game.sourceRecordId,game.id,game.sourceUrl,game.collectedAt,game.collectedAt] });
    }
    statements.push(this.stageStatement(targetDate,"games",complete ? "complete" : "partial",games.length,complete ? null : "Not all team schedule pages validated"));
    if (!dryRun) await this.client.batch(statements,"write");
    return { inserted, updated, skipped };
  }

  async findGamesByDate(date: string): Promise<NpbGame[]> {
    const result = await this.client.execute({ sql: "SELECT * FROM npb_games WHERE game_date=? ORDER BY scheduled_time,game_id", args: [date] });
    return result.rows.map((row) => ({ id: String(row.game_id), season: Number(row.season), date: String(row.game_date),
      homeTeamId: String(row.home_team_id), awayTeamId: String(row.away_team_id), gameNumber: Number(row.game_number),
      venue: row.venue === null ? null : String(row.venue), scheduledTime: row.scheduled_time === null ? null : String(row.scheduled_time),
      status: String(row.status) as NpbGame["status"], homeScore: row.home_score === null ? null : Number(row.home_score),
      awayScore: row.away_score === null ? null : Number(row.away_score), sourceKey: "nf3", sourceRecordId: String(row.source_record_id),
      sourceUrl: String(row.source_url), collectedAt: String(row.collected_at) }));
  }

  async linkGame(date: string, teamId: string, opponentTeamId: string, time: string | null): Promise<string> {
    const result = await this.client.execute({ sql: `SELECT game_id,scheduled_time FROM npb_games WHERE game_date=? AND
      ((home_team_id=? AND away_team_id=?) OR (home_team_id=? AND away_team_id=?))`,
      args: [date,teamId,opponentTeamId,opponentTeamId,teamId] });
    if (result.rows.length === 1) return String(result.rows[0]?.game_id);
    const match = result.rows.filter((row) => time && row.scheduled_time === time);
    if (match.length === 1) return String(match[0]?.game_id);
    throw new Error(`Unresolved/ambiguous game: ${date} ${teamId} ${opponentTeamId}`);
  }

  async saveBatting(rows: readonly NpbLogRow<PlayerGameBatting>[], targetDate: string, dryRun: boolean): Promise<{ inserted: number; updated: number }> {
    const statements: InStatement[] = [];
    let inserted = 0, updated = 0;
    for (const row of rows) {
      const fact = row.fact;
      const gameId = await this.linkGame(row.date,fact.teamId,row.opponentTeamId,row.scheduledTime);
      const prior = await this.client.execute({ sql: "SELECT 1 FROM player_game_batting WHERE game_id=? AND player_id=? AND team_id=?", args: [gameId,fact.playerId,fact.teamId] });
      if (prior.rows.length) updated++; else inserted++;
      statements.push({ sql: `INSERT INTO player_game_batting
        (game_id,player_id,team_id,opponent_team_id,batting_order,pa,ab,hits,doubles,triples,home_runs,rbi,walks,strikeouts,hbp,sb,cs,source_key,source_record_id,collected_at,runs,starter,source_url)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(game_id,player_id,team_id) DO UPDATE SET batting_order=excluded.batting_order,pa=excluded.pa,
          ab=excluded.ab,hits=excluded.hits,doubles=excluded.doubles,triples=excluded.triples,home_runs=excluded.home_runs,
          rbi=excluded.rbi,walks=excluded.walks,strikeouts=excluded.strikeouts,hbp=excluded.hbp,sb=excluded.sb,cs=excluded.cs,
          collected_at=excluded.collected_at,runs=excluded.runs,starter=excluded.starter,source_url=excluded.source_url`,
        args: [gameId,fact.playerId,fact.teamId,fact.opponentTeamId,fact.battingOrder,fact.pa,fact.ab,fact.hits,
          fact.doubles,fact.triples,fact.homeRuns,fact.rbi,fact.walks,fact.strikeouts,fact.hbp,fact.stolenBases,
          fact.caughtStealing,fact.sourceKey,fact.sourceRecordId,fact.collectedAt,fact.runs ?? null,fact.starter ? 1 : 0,fact.sourceUrl ?? null] });
    }
    statements.push(this.stageStatement(targetDate,"batting","partial",rows.length,"Curated player subset only"));
    if (!dryRun) await this.client.batch(statements,"write");
    return { inserted, updated };
  }

  async savePitching(rows: readonly NpbLogRow<PlayerGamePitching>[], targetDate: string, dryRun: boolean): Promise<{ inserted: number; updated: number }> {
    const statements: InStatement[] = [];
    let inserted = 0, updated = 0;
    for (const row of rows) {
      const fact = row.fact;
      const gameId = await this.linkGame(row.date,fact.teamId,row.opponentTeamId,row.scheduledTime);
      const prior = await this.client.execute({ sql: "SELECT 1 FROM player_game_pitching WHERE fact_id=?", args: [fact.id] });
      if (prior.rows.length) updated++; else inserted++;
      statements.push({ sql: `INSERT INTO player_game_pitching
        (fact_id,game_id,player_id,team_id,opponent_team_id,role,appearance_order,ip_outs,batters_faced,hits,home_runs,walks,strikeouts,runs,earned_runs,pitches,catcher_id,source_key,source_record_id,collected_at,starter,decision,source_url)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(fact_id) DO UPDATE SET game_id=excluded.game_id,role=excluded.role,ip_outs=excluded.ip_outs,
          batters_faced=excluded.batters_faced,hits=excluded.hits,home_runs=excluded.home_runs,walks=excluded.walks,
          strikeouts=excluded.strikeouts,runs=excluded.runs,earned_runs=excluded.earned_runs,pitches=excluded.pitches,
          collected_at=excluded.collected_at,starter=excluded.starter,decision=excluded.decision,source_url=excluded.source_url`,
        args: [fact.id,gameId,fact.playerId,fact.teamId,fact.opponentTeamId,fact.role,fact.appearanceOrder,
          fact.inningsPitchedOuts,fact.battersFaced,fact.hits,fact.homeRuns,fact.walks,fact.strikeouts,fact.runs,
          fact.earnedRuns,fact.pitches,fact.catcherId,fact.sourceKey,fact.sourceRecordId,fact.collectedAt,
          fact.starter ? 1 : 0,fact.decision ?? null,fact.sourceUrl ?? null] });
    }
    statements.push(this.stageStatement(targetDate,"pitching","partial",rows.length,"Curated player subset only"));
    if (!dryRun) await this.client.batch(statements,"write");
    return { inserted, updated };
  }

  async findBattingByPlayer(playerId: string, fromDate: string, toDate: string): Promise<PlayerGameBatting[]> {
    const result = await this.client.execute({ sql: `SELECT b.*,g.game_date FROM player_game_batting b
      JOIN npb_games g ON g.game_id=b.game_id WHERE b.player_id=? AND g.game_date BETWEEN ? AND ? ORDER BY g.game_date`,
      args: [playerId,fromDate,toDate] });
    return result.rows.map((row) => playerGameBattingSchema.parse({ gameId: row.game_id, playerId: row.player_id,
      teamId: row.team_id, opponentTeamId: row.opponent_team_id, battingOrder: row.batting_order,
      pa: row.pa, ab: row.ab, hits: row.hits, doubles: row.doubles, triples: row.triples,
      homeRuns: row.home_runs, rbi: row.rbi, walks: row.walks, strikeouts: row.strikeouts,
      hbp: row.hbp, stolenBases: row.sb, caughtStealing: row.cs, runs: row.runs,
      starter: row.starter === null ? null : Number(row.starter) === 1,
      sourceUrl: row.source_url, sourceKey: row.source_key, sourceRecordId: row.source_record_id,
      collectedAt: row.collected_at }));
  }

  async findPitchingByPlayer(playerId: string, fromDate: string, toDate: string): Promise<PlayerGamePitching[]> {
    const result = await this.client.execute({ sql: `SELECT p.*,g.game_date FROM player_game_pitching p
      JOIN npb_games g ON g.game_id=p.game_id WHERE p.player_id=? AND g.game_date BETWEEN ? AND ? ORDER BY g.game_date`,
      args: [playerId,fromDate,toDate] });
    return result.rows.map((row) => playerGamePitchingSchema.parse({ id: row.fact_id, gameId: row.game_id,
      playerId: row.player_id, teamId: row.team_id, opponentTeamId: row.opponent_team_id, role: row.role,
      appearanceOrder: row.appearance_order, inningsPitchedOuts: row.ip_outs, battersFaced: row.batters_faced,
      hits: row.hits, homeRuns: row.home_runs, walks: row.walks, strikeouts: row.strikeouts,
      runs: row.runs, earnedRuns: row.earned_runs, pitches: row.pitches, catcherId: row.catcher_id,
      starter: row.starter === null ? null : Number(row.starter) === 1, decision: row.decision,
      sourceUrl: row.source_url, sourceKey: row.source_key, sourceRecordId: row.source_record_id,
      collectedAt: row.collected_at }));
  }

  async markStage(date: string, stage: string, error: string): Promise<void> {
    await this.client.execute(this.stageStatement(date,stage,"failed",0,error.slice(0,300)));
  }
  private stageStatement(date: string, stage: string, status: string, count: number, error: string | null): InStatement {
    return { sql: `INSERT INTO npb_ingestion_stages VALUES (?,?,?,?,?,?) ON CONFLICT(target_date,stage) DO UPDATE SET
      status=excluded.status,record_count=excluded.record_count,updated_at=excluded.updated_at,error_summary=excluded.error_summary`,
      args: [date,stage,status,count,new Date().toISOString(),error] };
  }
}
