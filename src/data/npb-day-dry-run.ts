import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { gameCompletenessSchema, type GameCompleteness } from "../domain/game-facts";
import type { DataClient } from "./database";
import { runNpbGameProof, type NpbGameProofResult } from "./npb-game-collector";
import { normalizeNpbName, npbTeams, type NpbGame } from "./npb-nf3";
import { NpbRepository } from "./npb-repository";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve,ms));
const watchedTables = ["player_game_batting","player_game_pitching","source_entity_mappings","master_history",
  "npb_game_completeness","ingestion_runs","npb_ingestion_stages","raw_response_manifest"] as const;
async function tableFingerprints(client: DataClient): Promise<Record<string,string>> {
  const entries = await Promise.all(watchedTables.map(async (name) => {
    const result = await client.execute(`SELECT * FROM ${name} ORDER BY rowid`);
    return [name,createHash("sha256").update(JSON.stringify(result.rows)).digest("hex")] as const;
  }));
  return Object.fromEntries(entries);
}
export function createNf3DryRunSession(delayMs = 750, provided?: (url: string) => Promise<string>,
  rawRoot?: string, targetDate?: string) {
  const pages = new Map<string,string>();
  const metrics = { httpRequests:0,uniquePages:0,retries:0,cacheHits:0 };
  let last = 0;
  const request = async (url: string): Promise<string> => {
    const cached = pages.get(url);
    if (cached !== undefined) return cached;
    if (rawRoot && targetDate && !provided) {
      const source = new URL(url);
      const key = `${source.pathname.slice(1)}${source.search}`;
      const digest = createHash("sha256").update(key).digest("hex");
      try {
        const html = gunzipSync(await readFile(join(rawRoot,"nf3",targetDate,`${digest}.html.gz`))).toString("utf8");
        pages.set(url,html); metrics.uniquePages=pages.size; metrics.cacheHits++;
        return html;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (provided) {
      const html = await provided(url);
      pages.set(url,html); metrics.uniquePages = pages.size;
      return html;
    }
    if (new URL(url).hostname !== "nf3.sakura.ne.jp") throw new Error("Unexpected data source host");
    let error: unknown;
    for (let attempt=0;attempt<2;attempt++) {
      const pause = delayMs - (Date.now()-last);
      if (pause>0) await wait(pause);
      last = Date.now(); metrics.httpRequests++;
      try {
        const response = await fetch(url,{ headers:{"User-Agent":"BaseballDataAppCollector/0.1 (NPB daily game facts)"},
          signal:AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 500_000) throw new Error("Oversized nf3 response");
        const html = new TextDecoder("utf-8",{fatal:true}).decode(bytes);
        pages.set(url,html); metrics.uniquePages = pages.size;
        return html;
      } catch (caught) { error=caught; if (attempt===0) { metrics.retries++; await wait(1000); } }
    }
    throw new Error(`Network failure for ${url}: ${String(error)}`);
  };
  return { request,metrics };
}

type GameOutput = { gameId:string; matchup:string; report:GameCompleteness; fetchedPages:number;
  battingFacts:number; pitchingFacts:number; wouldCreateMappings:NpbGameProofResult["wouldCreateMappings"];
  observed:NpbGameProofResult["observed"]; nonBattingSubstitutes:NpbGameProofResult["nonBattingSubstitutes"];
  expectedMutations:{batting:number;pitching:number;mapping:number;completeness:number;ingestion:number} };
export type NpbDayDryRunResult = { targetDate:string; gamesExpected:number; gamesProcessed:number;
  gamesComplete:number; gamesPartial:number; gamesFailed:number; dayStatus:"complete"|"partial"|"failed";
  battersCollected:number; pitchersCollected:number; unresolvedPlayers:number; wouldCreateMappings:number;
  duplicateCandidateNames:string[]; validationErrors:number; parserFailures:number; networkFailures:number;
  httpRequests:number;
  uniquePages:number; retries:number; durationMs:number; noMutation:boolean;
  cacheHits:number;
  expectedMutations:{batting:number;pitching:number;mapping:number;completeness:number;ingestion:number}; games:GameOutput[] };
export function summarizeNpbDay(targetDate:string, games:GameOutput[], gamesExpected:number,
  metrics:{httpRequests:number;uniquePages:number;retries:number;cacheHits?:number},durationMs:number,noMutation:boolean):NpbDayDryRunResult {
  const gamesComplete = games.filter((item) => item.report.gameStatus === "complete").length;
  const gamesFailed = games.filter((item) => item.report.gameStatus === "failed").length;
  const gamesPartial = games.length-gamesComplete-gamesFailed;
  const candidates = new Map<string,{name:string;teamId:string}>();
  for (const game of games) for (const candidate of game.wouldCreateMappings)
    candidates.set(candidate.sourceId,{name:candidate.name,teamId:candidate.teamId});
  const byName = new Map<string,Set<string>>();
  for (const [sourceId,candidate] of candidates) {
    const name = normalizeNpbName(candidate.name);
    byName.set(name,(byName.get(name) ?? new Set()).add(sourceId));
  }
  const duplicateCandidateNames = [...byName].filter(([,ids]) => ids.size>1).map(([name]) => name);
  const unresolvedPlayers = games.reduce((sum,item) => sum + item.report.issues.filter((issue) =>
    /Unresolved|identity mismatch|identity changed|Conflicting.*identity/i.test(issue)).length,0);
  const validationErrors = games.reduce((sum,item) => sum+item.report.issues.length,0);
  const parserFailures = games.reduce((sum,item) => sum+item.report.issues.filter((issue) =>
    /schema changed|Missing\/ambiguous|Ambiguous nf3|Invalid .*row|Unknown nf3 .*marker/i.test(issue)).length,0);
  const networkFailures = games.reduce((sum,item) => sum+item.report.issues.filter((issue) =>
    /Network failure|HTTP \d{3}|TimeoutError/i.test(issue)).length,0);
  const expectedMutations = {batting:0,pitching:0,mapping:candidates.size,completeness:gamesExpected,ingestion:gamesExpected};
  for (const game of games) {
    expectedMutations.batting+=game.expectedMutations.batting;
    expectedMutations.pitching+=game.expectedMutations.pitching;
  }
  const dayStatus = gamesExpected===0 || gamesFailed===gamesExpected ? "failed" :
    games.length===gamesExpected && gamesComplete===gamesExpected && !duplicateCandidateNames.length && noMutation ? "complete" : "partial";
  return {targetDate,gamesExpected,gamesProcessed:games.length,gamesComplete,gamesPartial,gamesFailed,dayStatus,
    battersCollected:games.reduce((sum,item)=>sum+item.battingFacts,0),
    pitchersCollected:games.reduce((sum,item)=>sum+item.pitchingFacts,0),unresolvedPlayers,
    wouldCreateMappings:candidates.size,duplicateCandidateNames,validationErrors,parserFailures,networkFailures,
    httpRequests:metrics.httpRequests,uniquePages:metrics.uniquePages,retries:metrics.retries,durationMs,noMutation,
    cacheHits:metrics.cacheHits??0,expectedMutations,games};
}

function failedReport(game:NpbGame,error:unknown):GameCompleteness {
  return gameCompletenessSchema.parse({gameId:game.id,battingStatus:"failed",pitchingStatus:"failed",gameStatus:"failed",
    expectedBatters:0,collectedBatters:0,mappedBatters:0,expectedPitchers:0,collectedPitchers:0,mappedPitchers:0,
    checks:{},issues:[String(error)],sourceKey:"nf3",verifiedAt:new Date().toISOString()});
}
export async function runNpbDayDryRun(client:DataClient,targetDate:string,options:{delayMs?:number;
  request?:(url:string)=>Promise<string>;rawRoot?:string;
  runGame?:(game:NpbGame,request:(url:string)=>Promise<string>)=>Promise<NpbGameProofResult>}={}):Promise<NpbDayDryRunResult> {
  if (targetDate !== "2026-09-23") throw new Error("This manual proof is limited to 2026-09-23");
  const repository = new NpbRepository(client);
  const games = (await repository.findGamesByDate(targetDate)).filter((game)=>game.status==="final");
  if (!games.length) throw new Error(`No final games in Repository: ${targetDate}`);
  const before = await tableFingerprints(client);
  const session = createNf3DryRunSession(options.delayMs,options.request,options.rawRoot,targetDate);
  const start = Date.now();
  const outputs:GameOutput[] = [];
  for (const game of games) {
    const home = npbTeams.find((team)=>team.id===game.homeTeamId)?.short ?? game.homeTeamId;
    const away = npbTeams.find((team)=>team.id===game.awayTeamId)?.short ?? game.awayTeamId;
    const matchup = `${away} ${game.awayScore}–${game.homeScore} ${home}`;
    const existingBatting = (await repository.findBattingByGame(game.id)).length;
    const existingPitching = (await repository.findPitchingByGame(game.id)).length;
    try {
      const result = await (options.runGame ? options.runGame(game,session.request) : runNpbGameProof(client,
        {gameId:game.id,targetDate,dryRun:true,scope:"day-dry-run",request:session.request}));
      outputs.push({gameId:game.id,matchup,...result,expectedMutations:{
        batting:Math.max(0,result.battingFacts-existingBatting),pitching:Math.max(0,result.pitchingFacts-existingPitching),
        mapping:result.wouldCreateMappings.length,completeness:1,ingestion:1}});
    } catch (error) {
      outputs.push({gameId:game.id,matchup,report:failedReport(game,error),fetchedPages:0,battingFacts:0,pitchingFacts:0,
        wouldCreateMappings:[],observed:{sacrificeFlies:0,fractionalTwoOutPitchers:0},nonBattingSubstitutes:[],
        expectedMutations:{batting:0,pitching:0,mapping:0,completeness:0,ingestion:0}});
    }
  }
  const after = await tableFingerprints(client);
  return summarizeNpbDay(targetDate,outputs,games.length,session.metrics,Date.now()-start,
    JSON.stringify(before)===JSON.stringify(after));
}
