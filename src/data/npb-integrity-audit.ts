import { createHash } from "node:crypto";
import type { DataClient } from "./database";
import { NpbPeriodCoverageRepository } from "./npb-period-coverage-repository";
import type { PeriodWindow } from "../domain/player-period";
import { gameCompletenessSchema } from "../domain/game-facts";
import { shortenedFinalEvidenceSchema } from "../domain/npb-game-completion";
import { NpbRepository } from "./npb-repository";
import { validateNpbGameFacts } from "./npb-game-collector";
import type { NpbGame } from "./npb-nf3";
import { npbGameFactCountsCte, npbGameFactCountsJoins } from "./npb-game-fact-counts";

// Only SELECTs; no migrations, collectors, repairs or inferred completion evidence.
export async function auditNpbIntegrity(client: DataClient, window: PeriodWindow, asOfDate: string) {
  const season = Number(window.from.slice(0, 4));
  const saved = await client.execute({ sql: `${npbGameFactCountsCte} SELECT g.*,c.game_status,c.batting_status,c.pitching_status,
    c.game_id AS completeness_game_id,c.source_key AS completeness_source_key,
    c.expected_batters,c.collected_batters,c.mapped_batters,c.expected_pitchers,c.collected_pitchers,
    c.mapped_pitchers,c.checks_json,c.issues_json,c.verified_at,
    COALESCE(bc.saved_batting,0) AS saved_batting,COALESCE(bc.unknown_pa,0) AS unknown_pa,
    COALESCE(pc.saved_pitching,0) AS saved_pitching,pc.home_outs,pc.away_outs,
    (SELECT payload_json FROM permanent_events e WHERE e.event_id='npb:shortened-final:'||g.game_id) AS shortened_evidence
    FROM npb_games g LEFT JOIN npb_game_completeness c ON c.game_id=g.game_id ${npbGameFactCountsJoins}
    WHERE g.season=? AND g.game_date<=?
    ORDER BY g.game_date,g.game_id`, args: [season, asOfDate] });
  // Reviewed calendar and evaluated past coverage are different windows. Future
  // fixtures stay in boundary diagnostics, never in missing-day findings.
  const coverageWindow = { ...window, to: asOfDate < window.to ? asOfDate : window.to };
  const coverage = asOfDate < window.from ? null : await new NpbPeriodCoverageRepository(client).findPeriodCoverage(coverageWindow);
  const days = await client.execute({ sql: `SELECT * FROM (SELECT *,ROW_NUMBER() OVER
    (PARTITION BY target_date ORDER BY started_at DESC,run_id DESC) AS ordinal FROM npb_day_runs
    WHERE target_date BETWEEN ? AND ?) WHERE ordinal=1 ORDER BY target_date`, args: [window.from, asOfDate] });
  const stages = await client.execute({ sql: "SELECT * FROM npb_ingestion_stages WHERE target_date BETWEEN ? AND ? ORDER BY target_date,stage",
    args: [window.from, asOfDate] });
  const boundary = await client.execute({ sql: `${npbGameFactCountsCte} SELECT g.*,c.game_status,c.batting_status,c.pitching_status,
    COALESCE(bc.saved_batting,0) AS saved_batting,COALESCE(pc.saved_pitching,0) AS saved_pitching
    FROM npb_games g LEFT JOIN npb_game_completeness c ON c.game_id=g.game_id ${npbGameFactCountsJoins}
    WHERE g.season=? AND g.game_date>=? ORDER BY g.game_date,g.game_id`, args: [season, window.to] });
  const repo = new NpbRepository(client);
  const inputErrors: string[] = [];
  const [batting, pitching] = await Promise.all([
    repo.findBattingByPeriod(`${season}-01-01`,asOfDate,null,season).catch(() => {inputErrors.push("batting_read_or_schema_failed");return null;}),
    repo.findPitchingByPeriod(`${season}-01-01`,asOfDate,null,season).catch(() => {inputErrors.push("pitching_read_or_schema_failed");return null;}),
  ]);
  const byGame = <T extends {gameId:string}>(rows: readonly T[]) => {
    const map=new Map<string,T[]>();for(const r of rows){const group=map.get(r.gameId)??[];group.push(r);map.set(r.gameId,group);}return map;
  };
  const bats=byGame(batting??[]),pitches=byGame(pitching??[]);
  const audited = saved.rows.map(row => {
    const r: Record<string, unknown> = Object.fromEntries(Object.entries(row));
    const evidenceErrors: { field: string; reason: string; sha256: string }[] = [];
    const parse = (value: unknown, field: string, valid: (value: unknown) => boolean): unknown => {
      if (value == null) return null;
      let parsed: unknown, reason = "invalid_json";
      try { parsed = JSON.parse(String(value)) as unknown; reason = "invalid_shape"; if (valid(parsed)) return parsed; }
      catch { /* Preserve the diagnostic even when JSON syntax itself is broken. */ }
        // Preserve the database value, but never expose arbitrary corrupted raw text.
        evidenceErrors.push({ field, reason, sha256: createHash("sha256").update(String(value)).digest("hex") });
        return null;
    };
    const checks = parse(r.checks_json, "checks_json", v => gameCompletenessSchema.shape.checks.safeParse(v).success),
      issues = parse(r.issues_json, "issues_json", v => gameCompletenessSchema.shape.issues.safeParse(v).success),
      shortenedEvidence = parse(r.shortened_evidence, "shortened_evidence", v => shortenedFinalEvidenceSchema.safeParse(v).success);
    const integrityErrors: string[] = [];
    if (r.completeness_game_id != null && checks !== null && issues !== null && !gameCompletenessSchema.safeParse({
      gameId:r.completeness_game_id,battingStatus:r.batting_status,pitchingStatus:r.pitching_status,gameStatus:r.game_status,
      expectedBatters:r.expected_batters,collectedBatters:r.collected_batters,mappedBatters:r.mapped_batters,
      expectedPitchers:r.expected_pitchers,collectedPitchers:r.collected_pitchers,mappedPitchers:r.mapped_pitchers,
      checks,issues,sourceKey:r.completeness_source_key,verifiedAt:r.verified_at }).success) integrityErrors.push("invalid_completeness_metadata");
    const claimedComplete = r.game_status === "complete" && r.batting_status === "complete" && r.pitching_status === "complete";
    if (claimedComplete && (Number(r.saved_batting) !== Number(r.expected_batters) ||
        Number(r.saved_batting) !== Number(r.collected_batters) || Number(r.saved_batting) !== Number(r.mapped_batters) ||
        Number(r.saved_pitching) !== Number(r.expected_pitchers) || Number(r.saved_pitching) !== Number(r.collected_pitchers) ||
        Number(r.saved_pitching) !== Number(r.mapped_pitchers) || Number(r.expected_batters) < 18 || Number(r.expected_pitchers) < 2))
      integrityErrors.push("complete_proof_fact_count_mismatch");
    if (claimedComplete && checks && issues && (Object.values(checks).some(v => v !== true) || (issues as string[]).length))
      integrityErrors.push("complete_proof_has_failed_checks");
    if (shortenedEvidence) {
      const e = shortenedFinalEvidenceSchema.parse(shortenedEvidence);
      if (e.gameId !== r.game_id || e.homeTeamId !== r.home_team_id || e.awayTeamId !== r.away_team_id ||
          e.homeScore !== r.home_score || e.awayScore !== r.away_score || r.status !== "final")
        integrityErrors.push("shortened_evidence_game_mismatch");
    }
    // Reuse authoritative Game validation, including PA, team-specific checks,
    // runs/hits/opponents/starter roles and explicit ending evidence. Counts and
    // old complete flags alone cannot certify the current saved Facts.
    if (claimedComplete && !integrityErrors.length && !evidenceErrors.length) {
      if (!batting || !pitching) integrityErrors.push("actual_fact_validation_unavailable");
      else {
        const game: NpbGame = { id:String(r.game_id),season:Number(r.season),date:String(r.game_date),
          homeTeamId:String(r.home_team_id),awayTeamId:String(r.away_team_id),gameNumber:Number(r.game_number),
          venue:r.venue==null?null:String(r.venue),scheduledTime:r.scheduled_time==null?null:String(r.scheduled_time),
          status:r.status as NpbGame["status"],homeScore:r.home_score==null?null:Number(r.home_score),awayScore:r.away_score==null?null:Number(r.away_score),
          sourceKey:"nf3",sourceRecordId:String(r.source_record_id),sourceUrl:String(r.source_url),collectedAt:String(r.collected_at),
          ...(shortenedEvidence?{completionEvidence:shortenedFinalEvidenceSchema.parse(shortenedEvidence)}:{}) };
        const actual=validateNpbGameFacts(game,Number(r.expected_batters),bats.get(game.id)??[],Number(r.expected_pitchers),
          pitches.get(game.id)??[],Number(r.mapped_batters),Number(r.mapped_pitchers));
        if (actual.gameStatus!=="complete") integrityErrors.push(...actual.issues.map(i=>`actual_fact: ${i}`));
        if (Object.keys(actual.checks).some(k=>(checks as Record<string,boolean>)[k]!==true)) integrityErrors.push("complete_proof_missing_required_checks");
      }
    }
    delete r.checks_json; delete r.issues_json; delete r.shortened_evidence;
    return { ...r, checks, issues, shortenedEvidence, evidenceErrors, integrityErrors,
      pending: r.status !== "postponed" && r.status !== "canceled" && (r.status !== "final" || !claimedComplete || evidenceErrors.length > 0 || integrityErrors.length > 0) } as Record<string, unknown> & { evidenceErrors: typeof evidenceErrors; integrityErrors: string[]; pending: boolean };
  });
  return { season, window, asOfDate, checkedGames: audited.length, inputErrors, pendingGames: audited.filter(r => r.pending),
  evidenceFindings: audited.filter(r => r.evidenceErrors.length || r.integrityErrors.length),
  boundaryGames: boundary.rows, coverage, coverageEvaluation: coverage ? "evaluated" : "before_reviewed_calendar",
  partialDays: (coverage?.calendar ?? []).filter(d => d.status !== "complete" && d.status !== "no_games")
    .map(d => ({ ...d, latestRun: days.rows.find(r => r.target_date === d.date) ?? null,
      stages: stages.rows.filter(r => r.target_date === d.date) })),
  boundaryDays: days.rows.filter(r => String(r.target_date) >= window.to) };
}

export async function hashNpbIntegrity(client: DataClient) {
  const tables = ["npb_games", "player_game_batting", "player_game_pitching", "npb_game_completeness",
    "npb_day_runs", "npb_ingestion_stages", "permanent_events", "master_history"] as const;
  const result: Record<string, { count: number; sha256: string }> = {};
  for (const table of tables) {
    // Fixed table names only. Database row values never appear in the output.
    const rows = (await client.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows;
    result[table] = { count: rows.length, sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
  }
  return result;
}
