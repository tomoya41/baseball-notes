import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { load } from "cheerio";
import type { DataClient } from "./database";
import { gameCompletenessSchema, type GameCompleteness, type PlayerGameBatting, type PlayerGamePitching } from "../domain/game-facts";
import { addDays, jstToday } from "./npb-collector";
import { npbTeams, normalizeNpbName, type NpbGame, type NpbLogRow } from "./npb-nf3";
import { findRosterPlayer, parseNf3BattingRoster, parseNf3GameBattingRow, parseNf3GamePitchingRow,
  parseNf3PitchUsage, parseNf3StartingLineup, nf3ProfileParameter, hasNf3BattingGameRow,
  type Nf3BattingParticipant } from "./npb-game-source";
import { NpbRepository } from "./npb-repository";
import { retentionDays } from "./retention";
import { sourceRegistry } from "./source-registry";

const ROOT = "https://nf3.sakura.ne.jp/";
const HEADERS = { "User-Agent": "BaseballDataAppCollector/0.1 (controlled one-game completeness check)" };
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const total = (values: readonly (number | null | undefined)[]): number | null =>
  values.some((value) => value === null || value === undefined) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);

export interface NpbGameProofOptions {
  gameId: string;
  targetDate: string;
  dryRun?: boolean;
  rawRoot?: string;
  request?: (url: string) => Promise<string>;
  delayMs?: number;
  persistRawManifest?: boolean;
  scope?: "controlled" | "day-dry-run" | "day-ingest";
}
export interface NpbGameProofResult {
  report: GameCompleteness;
  fetchedPages: number;
  battingFacts: number;
  pitchingFacts: number;
  insertedBatting: number;
  insertedPitching: number;
  wouldCreateMappings: { sourceId: string; name: string; teamId: string; sourceUrl: string }[];
  observed: { sacrificeFlies: number; fractionalTwoOutPitchers: number };
  nonBattingSubstitutes: { sourceId: string; name: string }[];
}

export const controlledGameTargets = {
  baseline: { id: "npb:game:31c350227cecf978f3e8", date: "2026-09-23",
    home: "npb:team:marines", away: "npb:team:buffaloes", homeScore: 0, awayScore: 1 },
  edge: { id: "npb:game:7625951a1eb2412e96c1", date: "2026-09-23",
    home: "npb:team:hawks", away: "npb:team:lions", homeScore: 10, awayScore: 3 },
  primary: { id: "npb:game:838179e9f7cb8080304b", date: "2026-09-23",
    home: "npb:team:carp", away: "npb:team:giants", homeScore: 1, awayScore: 2 },
  supplemental: { id: "npb:game:b37526c92a94ecb96bf7", date: "2026-09-23",
    home: "npb:team:baystars", away: "npb:team:dragons", homeScore: 4, awayScore: 3 },
} as const;
export type ControlledGameTarget = keyof typeof controlledGameTargets;

// nf3's schedule row has the final score but no independently stated final inning.
// Reject shortened/ambiguous shapes rather than guessing a 27-out regulation game.
export function hasPlausibleFinalOuts(game: NpbGame, homeOuts: number | null, awayOuts: number | null): boolean {
  if (game.status !== "final" || game.homeScore === null || game.awayScore === null ||
    homeOuts === null || awayOuts === null || homeOuts < 27 || homeOuts % 3 !== 0) return false;
  if (game.homeScore <= game.awayScore) return awayOuts === homeOuts;
  return awayOuts >= homeOuts - 3 && awayOuts < homeOuts;
}

export function validateNpbGameFacts(game: NpbGame, expectedBatters: number, batting: readonly PlayerGameBatting[],
  expectedPitchers: number, pitching: readonly PlayerGamePitching[], mappedBatters: number, mappedPitchers: number,
  issues: string[] = []): GameCompleteness {
  const homeOuts = total(pitching.filter((row) => row.teamId === game.homeTeamId).map((row) => row.inningsPitchedOuts));
  const awayOuts = total(pitching.filter((row) => row.teamId === game.awayTeamId).map((row) => row.inningsPitchedOuts));
  const legalOuts = hasPlausibleFinalOuts(game,homeOuts,awayOuts);
  const checks: Record<string, boolean> = {
    finalGame: game.status === "final" && game.homeScore !== null && game.awayScore !== null,
    batterCoverage: expectedBatters >= 18 && batting.length === expectedBatters && mappedBatters === expectedBatters,
    pitcherCoverage: expectedPitchers >= 2 && pitching.length === expectedPitchers && mappedPitchers === expectedPitchers,
    uniqueBatters: new Set(batting.map((row) => `${row.teamId}:${row.playerId}`)).size === batting.length,
    uniquePitchers: new Set(pitching.map((row) => `${row.teamId}:${row.playerId}`)).size === pitching.length,
    plateAppearancesKnown: batting.every((row) => row.pa !== null),
  };
  for (const [teamId, opponentId, score, allowed] of [
    [game.homeTeamId,game.awayTeamId,game.homeScore,game.awayScore],
    [game.awayTeamId,game.homeTeamId,game.awayScore,game.homeScore],
  ] as const) {
    const hitters = batting.filter((row) => row.teamId === teamId);
    const pitchers = pitching.filter((row) => row.teamId === teamId);
    const opposingPitchers = pitching.filter((row) => row.teamId === opponentId);
    const key = teamId;
    checks[`battingStarters:${key}`] = hitters.filter((row) => row.starter).length === 9;
    checks[`battingOrder:${key}`] = new Set(hitters.filter((row) => row.starter).map((row) => row.battingOrder)).size === 9 &&
      hitters.every((row) => row.battingOrder !== null);
    checks[`battingRuns:${key}`] = total(hitters.map((row) => row.runs)) === score;
    checks[`extraBaseComposition:${key}`] = hitters.every((row) => row.hits !== null && row.doubles !== null &&
      row.triples !== null && row.homeRuns !== null && row.doubles + row.triples + row.homeRuns <= row.hits);
    checks[`pitchingRuns:${key}`] = total(pitchers.map((row) => row.runs)) === allowed;
    checks[`hits:${key}`] = total(hitters.map((row) => row.hits)) === total(opposingPitchers.map((row) => row.hits));
    checks[`homeRuns:${key}`] = total(hitters.map((row) => row.homeRuns)) === total(opposingPitchers.map((row) => row.homeRuns));
    checks[`plateAppearances:${key}`] = total(hitters.map((row) => row.pa)) === total(opposingPitchers.map((row) => row.battersFaced));
    checks[`pitchingOuts:${key}`] = legalOuts;
    checks[`oneStarter:${key}`] = pitchers.filter((row) => row.starter).length === 1;
    checks[`opponents:${key}`] = hitters.every((row) => row.opponentTeamId === opponentId) &&
      pitchers.every((row) => row.opponentTeamId === opponentId);
  }
  const failedChecks = Object.entries(checks).filter(([,ok]) => !ok).map(([name]) => name);
  const allIssues = [...issues,...failedChecks.map((name) => `Check failed: ${name}`)];
  const battingStatus = !checks.batterCoverage || !checks.uniqueBatters || !checks.plateAppearancesKnown ||
    Object.entries(checks).some(([key,ok]) => (key.startsWith("battingRuns:") || key.startsWith("extraBaseComposition:") || key.startsWith("battingStarters:") ||
      key.startsWith("battingOrder:")) && !ok) ? "partial" : "complete";
  const pitchingStatus = !checks.pitcherCoverage || !checks.uniquePitchers ||
    Object.entries(checks).some(([key,ok]) => (key.startsWith("pitchingRuns:") || key.startsWith("pitchingOuts:") || key.startsWith("oneStarter:")) && !ok)
    ? "partial" : "complete";
  return gameCompletenessSchema.parse({ gameId: game.id, battingStatus, pitchingStatus,
    gameStatus: allIssues.length ? "partial" : "complete", expectedBatters, collectedBatters: batting.length,
    mappedBatters, expectedPitchers, collectedPitchers: pitching.length, mappedPitchers,
    checks, issues: allIssues, sourceKey: "nf3", verifiedAt: new Date().toISOString() });
}

export async function runNpbGameProof(client: DataClient, options: NpbGameProofOptions): Promise<NpbGameProofResult> {
  const { targetDate, gameId, dryRun = false, rawRoot = ".data/raw", delayMs = 750, persistRawManifest = true,
    scope = "controlled" } = options;
  const target = Object.values(controlledGameTargets).find((candidate) => candidate.id === gameId && candidate.date === targetDate);
  if ((scope === "controlled" && !target) || (scope === "day-dry-run" && (!dryRun || targetDate !== "2026-09-23")) ||
    (scope === "day-ingest" && !/^2026-\d{2}-\d{2}$/.test(targetDate)) ||
    targetDate > addDays(jstToday(),-1))
    throw new Error("This controlled proof is limited to reviewed 2026-09-23 games");
  if (process.env.NPB_NF3_ENABLED === "false" ||
    sourceRegistry.find((source) => source.key === "nf3")?.status !== "enabled-limited-public")
    throw new Error("nf3 provider is disabled in Source Registry");
  const repository = new NpbRepository(client);
  const games = await repository.findGamesByDate(targetDate);
  const game = games.find((item) => item.id === gameId);
  if (!game || game.status !== "final") throw new Error(`Missing final game: ${gameId}`);
  if (target && (game.homeTeamId !== target.home || game.awayTeamId !== target.away ||
    game.homeScore !== target.homeScore || game.awayScore !== target.awayScore))
    throw new Error("Unexpected controlled game identity/score");
  const teams = [game.homeTeamId,game.awayTeamId].map((id) => npbTeams.find((team) => team.id === id)!);
  const at = new Date().toISOString();
  let lastRequest = 0;
  let fetchedPages = 0;
  const request = options.request ?? (async (url: string) => {
    const wait = delayMs - (Date.now() - lastRequest);
    if (wait > 0) await pause(wait);
    lastRequest = Date.now();
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url,{ headers: HEADERS, signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 500_000) throw new Error("Oversized nf3 response");
        return new TextDecoder("utf-8",{ fatal: true }).decode(bytes);
      } catch (error) { last = error; if (attempt === 0) await pause(1000); }
    }
    throw new Error(`Network failure for ${url}: ${String(last)}`);
  });
  const seen = new Map<string,string>();
  async function get(path: string): Promise<string> {
    if (seen.has(path)) return seen.get(path)!;
    const url = new URL(path,ROOT).toString();
    const html = await request(url);
    fetchedPages++;
    if (!dryRun) {
      const objectKey = `nf3/${targetDate}/${createHash("sha256").update(path).digest("hex")}.html.gz`;
      await mkdir(join(rawRoot,"nf3",targetDate),{ recursive: true });
      await writeFile(join(rawRoot,objectKey),gzipSync(html));
      if (persistRawManifest) await client.execute({ sql: `INSERT INTO raw_response_manifest VALUES (?,'nf3','raw-response',?,?)
        ON CONFLICT(object_key) DO UPDATE SET stored_at=excluded.stored_at,expires_at=excluded.expires_at`,
        args: [objectKey,at,new Date(Date.now()+retentionDays.rawResponse*86_400_000).toISOString()] });
    }
    seen.set(path,html);
    return html;
  }
  const batting: NpbLogRow<PlayerGameBatting>[] = [];
  const pitching: NpbLogRow<PlayerGamePitching>[] = [];
  const issues: string[] = [];
  const wouldCreateMappings: NpbGameProofResult["wouldCreateMappings"] = [];
  const recordMapping = (sourceId: string, name: string, teamId: string, sourceUrl: string) => {
    if (!wouldCreateMappings.some((item) => item.sourceId === sourceId))
      wouldCreateMappings.push({sourceId,name,teamId,sourceUrl});
  };
  const nonBattingSubstitutes: NpbGameProofResult["nonBattingSubstitutes"] = [];
  let expectedBatters = 0, expectedPitchers = 0, mappedBatters = 0, mappedPitchers = 0;
  for (const team of teams) {
    const opponent = teams.find((item) => item.id !== team.id)!;
    const leg = team.group === "Central" ? 0 : 1;
    const month = Number(targetDate.slice(5,7));
    const lineupPath = `php/stat_disp/stat_disp.php?y=0&leg=${leg}&mon=${month}&tm=${team.code}&stvst=all`;
    const rosterPath = `php/stat_disp/stat_disp.php?y=0&leg=${leg}&tm=${team.code}&fp=0&dn=1&dk=0`;
    const usagePath = `${team.group}/${team.code}/t/pc_all_data_last2w_pn.htm`;
    const starters = parseNf3StartingLineup(await get(lineupPath),targetDate,team.code);
    const roster = parseNf3BattingRoster(await get(rosterPath),team.code);
    const expectedPitcherList = parseNf3PitchUsage(await get(usagePath),targetDate,team.code);
    const participants = [...roster];
    for (const pitcher of expectedPitcherList) {
      const existing = participants.find((player) => player.number === pitcher.number);
      if (existing && normalizeNpbName(existing.name) !== normalizeNpbName(pitcher.name))
        throw new Error(`Conflicting batter/pitcher identity: ${team.code} #${pitcher.number}`);
      if (!existing) participants.push(pitcher);
    }
    const queue: Nf3BattingParticipant[] = starters.map((starter) => {
      const verified = participants.find((player) => player.number === starter.number);
      const pitchingProfile = expectedPitcherList.find((player) => player.number === starter.number)?.profileUrl;
      if (!verified || (verified.profileUrl !== starter.profileUrl && pitchingProfile !== starter.profileUrl))
        throw new Error(`Lineup/roster identity mismatch: ${team.code} #${starter.number}`);
      return { ...verified, battingOrder: starter.battingOrder, started: true };
    });
    const processed = new Set<string>();
    while (queue.length) {
      const participant = queue.shift()!;
      if (processed.has(participant.number)) continue;
      processed.add(participant.number);
      expectedBatters++;
      const sourceId = `2026:${team.code}:uniform:${participant.number}`;
      const profileId = nf3ProfileParameter(participant.profileUrl,team.code,participant.number);
      const path = `php/stat_disp/stat_disp.php?y=0&leg=${leg}&fpnum=${profileId}&tm=${team.code}&mon=${month}&vst=all`;
      try {
        const html = await get(path);
        const $ = load(html);
        const identity = $("span[style*='font-size:24px']").filter((_, element) => $(element).text().includes(`#${participant.number}`)).first().text();
        if (!identity.includes(`#${participant.number}`) || !normalizeNpbName(identity).includes(normalizeNpbName(participant.name)))
          throw new Error(`Player identity mismatch: ${sourceId}`);
        if (!hasNf3BattingGameRow(html,targetDate) && !participant.started) {
          expectedBatters--;
          nonBattingSubstitutes.push({sourceId,name:participant.name});
          continue;
        }
        const playerId = await repository.resolveVerifiedPlayer(sourceId,participant.name,participant.profileUrl,team.id,at,true,
          () => recordMapping(sourceId,participant.name,team.id,participant.profileUrl));
        if (playerId.startsWith("dry:")) recordMapping(sourceId,participant.name,team.id,participant.profileUrl);
        mappedBatters++;
        const parsed = parseNf3GameBattingRow(html,targetDate,team.code,playerId,sourceId,new URL(path,ROOT).toString(),at);
        if (parsed.unsupportedPaEvents.length)
          issues.push(`Unsupported PA event ${sourceId}: ${parsed.unsupportedPaEvents.join(",")}`);
        if (parsed.row.opponentTeamId !== opponent.id || (game.scheduledTime && parsed.row.scheduledTime !== game.scheduledTime))
          throw new Error(`Batting game identity mismatch: ${sourceId}`);
        const fact = { ...parsed.row.fact, gameId: game.id, battingOrder: participant.battingOrder, starter: participant.started };
        batting.push({ ...parsed.row, fact });
        for (const name of parsed.substitutions) {
          const next = findRosterPlayer(participants,name);
          const already = queue.find((item) => item.number === next.number);
          if (already && already.battingOrder !== participant.battingOrder) throw new Error(`Conflicting batting-order slot: ${name}`);
          if (!processed.has(next.number) && !already)
            queue.push({ ...next, battingOrder: participant.battingOrder, started: false });
        }
      } catch (error) { issues.push(`batting/${sourceId}: ${String(error)}`); }
    }
    for (const pitcher of expectedPitcherList) {
      expectedPitchers++;
      const sourceId = `2026:${team.code}:uniform:${pitcher.number}`;
      const profileId = nf3ProfileParameter(pitcher.profileUrl,team.code,pitcher.number);
      const path = `php/stat_disp/stat_disp.php?y=0&leg=${leg}&pcnum=${profileId}&tm=${team.code}&mon=${month}&vst=all`;
      try {
        const html = await get(path);
        const $ = load(html);
        const identity = $("span[style*='font-size:24px']").filter((_, element) => $(element).text().includes(`#${pitcher.number}`)).first().text();
        if (!identity.includes(`#${pitcher.number}`) || !normalizeNpbName(identity).includes(normalizeNpbName(pitcher.name)))
          throw new Error(`Pitcher identity mismatch: ${sourceId}`);
        const playerId = await repository.resolveVerifiedPlayer(sourceId,pitcher.name,pitcher.profileUrl,team.id,at,true,
          () => recordMapping(sourceId,pitcher.name,team.id,pitcher.profileUrl));
        if (playerId.startsWith("dry:")) recordMapping(sourceId,pitcher.name,team.id,pitcher.profileUrl);
        mappedPitchers++;
        const row = parseNf3GamePitchingRow(html,targetDate,team.code,playerId,sourceId,new URL(path,ROOT).toString(),at);
        if (row.opponentTeamId !== opponent.id || (game.scheduledTime && row.scheduledTime !== game.scheduledTime))
          throw new Error(`Pitching game identity mismatch: ${sourceId}`);
        pitching.push({ ...row, fact: { ...row.fact, gameId: game.id } });
      } catch (error) { issues.push(`pitching/${sourceId}: ${String(error)}`); }
    }
  }
  const report = validateNpbGameFacts(game,expectedBatters,batting.map((row) => row.fact),expectedPitchers,
    pitching.map((row) => row.fact),mappedBatters,mappedPitchers,issues);
  const observed = { sacrificeFlies: batting.reduce((sum,row) => sum + (row.fact.sacrificeFlies ?? 0),0),
    fractionalTwoOutPitchers: pitching.filter((row) => row.fact.inningsPitchedOuts !== null &&
      row.fact.inningsPitchedOuts % 3 === 2).length };
  if (dryRun || report.gameStatus !== "complete") {
    if (!dryRun) {
      const previous = await repository.findGameCompleteness(game.id);
      if (previous?.gameStatus !== "complete") await repository.saveGameCompleteness(report);
    }
    return { report,fetchedPages,battingFacts:batting.length,pitchingFacts:pitching.length,
      insertedBatting:0,insertedPitching:0,wouldCreateMappings,observed,nonBattingSubstitutes };
  }
  const runId = randomUUID();
  const transaction = await client.transaction("write");
  try {
    // All new identities and both kinds of facts commit together for one verified game.
    const inTransaction = new NpbRepository(transaction as unknown as DataClient);
    const resolved = new Map<string,string>();
    for (const candidate of wouldCreateMappings) {
      resolved.set(candidate.sourceId,await inTransaction.resolveVerifiedPlayer(candidate.sourceId,
        candidate.name,candidate.sourceUrl,candidate.teamId,at,false));
    }
    const canonical = (id:string) => id.startsWith("dry:") ? (resolved.get(id.slice(4)) ??
      (() => { throw new Error(`Missing canonical player mapping: ${id}`); })()) : id;
    const committedBatting = batting.map((row) => ({...row,fact:{...row.fact,playerId:canonical(row.fact.playerId)}}));
    const committedPitching = pitching.map((row) => {
      const playerId = canonical(row.fact.playerId);
      return {...row,fact:{...row.fact,playerId,id:row.fact.id.replace(row.fact.playerId,playerId)}};
    });
    await transaction.execute({ sql: "INSERT INTO ingestion_runs (run_id,source_key,target_date,started_at,status) VALUES (?,'nf3',?,?,'running')",
      args: [runId,targetDate,at] });
    const b = await inTransaction.saveBatting(committedBatting,targetDate,false,false);
    const p = await inTransaction.savePitching(committedPitching,targetDate,false,false);
    const savedBatting = await inTransaction.findBattingByGame(game.id);
    const savedPitching = await inTransaction.findPitchingByGame(game.id);
    if (savedBatting.length !== batting.length || savedPitching.length !== pitching.length)
      throw new Error("Saved game facts do not match verified participant counts");
    await inTransaction.saveGameCompleteness(report);
    await transaction.execute({ sql: `UPDATE ingestion_runs SET finished_at=?,status='succeeded',fetched_count=?,
      inserted_count=?,updated_count=?,error_count=0 WHERE run_id=?`, args: [new Date().toISOString(),fetchedPages,
      b.inserted+p.inserted,b.updated+p.updated,runId] });
    await transaction.commit();
    return { report,fetchedPages,battingFacts:savedBatting.length,pitchingFacts:savedPitching.length,
      insertedBatting:b.inserted,insertedPitching:p.inserted,wouldCreateMappings,observed,nonBattingSubstitutes };
  } catch (error) {
    await transaction.rollback();
    const previous = await repository.findGameCompleteness(game.id);
    if (previous?.gameStatus !== "complete") await repository.saveGameCompleteness(
      { ...report, gameStatus: "failed", issues: [...report.issues, String(error).slice(0,300)] });
    await client.execute({ sql: "INSERT INTO ingestion_runs (run_id,source_key,target_date,started_at,finished_at,status,error_count,error_summary) VALUES (?,'nf3',?,?,?,'failed',1,?)",
      args: [runId,targetDate,at,new Date().toISOString(),String(error).slice(0,500)] });
    throw error;
  } finally {
    transaction.close();
  }
}
