import type { DataClient } from "./database";
import { addDays, jstToday } from "./npb-collector";
import { previousJstDate, runNpbDayFacts } from "./npb-day-collector";
import { createNf3DryRunSession } from "./npb-day-dry-run";
import { parseNf3TeamGames, npbTeams, type NpbGame } from "./npb-nf3";
import { parseNf3PitchUsage } from "./npb-game-source";
import { runNpbGameProof, validateNpbGameFacts } from "./npb-game-collector";
import { NpbRepository } from "./npb-repository";
import { findNpbRegularSeason } from "./npb-season-metadata";
import { sourceRegistry } from "./source-registry";

export function backfillDates(from: string, to: string, now = new Date()): string[] {
  const season = findNpbRegularSeason(to);
  if (!season || !/^2026-\d{2}-\d{2}$/.test(from) || !/^2026-\d{2}-\d{2}$/.test(to) ||
    from < season.startDate || to > season.endDate || from > to || to > previousJstDate(now) ||
    new Date(`${from}T00:00:00Z`).toISOString().slice(0,10) !== from ||
    new Date(`${to}T00:00:00Z`).toISOString().slice(0,10) !== to) throw new Error("Invalid completed regular-season range");
  const dates: string[] = [];
  for (let date=from;date<=to;date=addDays(date,1)) dates.push(date);
  return dates;
}

// Two independent team schedules must agree. Absence is evidence only after all 12 pages parse.
export function reconcileHistoricalSchedules(pages: readonly NpbGame[][]): NpbGame[] {
  if (pages.length !== npbTeams.length) throw new Error("All twelve validated schedules required");
  const byId = new Map<string,NpbGame[]>();
  for (const page of pages) {
    if (new Set(page.map(g=>g.id)).size !== page.length) throw new Error("Duplicate game within schedule");
    for (const game of page) byId.set(game.id,[...(byId.get(game.id) ?? []),game]);
  }
  return [...byId.values()].map(rows=>{
    const first=rows[0]!;
    if (rows.length!==2 || rows.some(g=>g.status!==first.status || g.homeScore!==first.homeScore ||
      g.awayScore!==first.awayScore || g.homeTeamId!==first.homeTeamId || g.awayTeamId!==first.awayTeamId))
      throw new Error(`Conflicting or one-sided schedule: ${first.id}`);
    return first;
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}

export async function runHistoricalBackfill(client: DataClient, options: {
  from: string; to: string; dryRun?: boolean; scratch?: boolean; request?: (url:string)=>Promise<string>;
  progress?: (result: unknown)=>Promise<void>; now?: Date;
}) {
  const dates=backfillDates(options.from,options.to,options.now);
  if (options.dryRun && !options.scratch) throw new Error("Dry-run requires a caller-owned scratch database");
  // y=0 is this provider's current-season alias. Never stamp next year's pages as 2026.
  if (!jstToday(options.now ?? new Date()).startsWith("2026-"))
    throw new Error("The current-year nf3 adapter cannot verify historical 2026 data after the year changes");
  if (process.env.NPB_NF3_ENABLED === "false" || sourceRegistry.find(s=>s.key==="nf3")?.status!=="enabled-limited-public")
    throw new Error("nf3 provider disabled");
  const repository=new NpbRepository(client);
  const session=createNf3DryRunSession(1000,options.request);
  const monthly=new Map<string,NpbGame[]>();
  const monthlyFailures=new Map<string,string>();
  const reports: { date:string; status:string; issues:string[]; result?:unknown }[]=[];
  const started=performance.now();
  for(const date of dates) {
    let status="unknown";
    const issues: string[]=[];
    try {
      const month=date.slice(5,7);
      if(monthlyFailures.has(month)) throw new Error(monthlyFailures.get(month));
      if(!monthly.has(month)) {
        try {
        const pages: NpbGame[][]=[];
        for(const team of npbTeams) {
          const url=`https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=${team.group==="Central"?0:1}&mon=${Number(month)}&tm=${team.code}&vst=all`;
          pages.push(parseNf3TeamGames(await session.request(url),team.code,2026,url,new Date().toISOString()));
        }
        monthly.set(month,reconcileHistoricalSchedules(pages));
        } catch(error) { monthlyFailures.set(month,String(error)); throw error; }
      }
      const games=monthly.get(month)!.filter(g=>g.date===date);
      // Future/postponed rows are not final Facts; a completed-day scheduled row remains unresolved.
      if(games.some(g=>g.status==="scheduled" || g.status==="unknown" || g.status==="suspended"))
        throw new Error("Unresolved non-final schedule row on completed date");
      const stages=await repository.findStageStatuses(date);
      let reusable=stages.games==="complete";
      const prior=await repository.findGamesByDate(date);
      reusable &&= prior.length===games.length && prior.every(g=>games.some(n=>n.id===g.id && n.status===g.status &&
        n.homeScore===g.homeScore && n.awayScore===g.awayScore));
      for(const game of games.filter(g=>g.status==="final")) {
        const evidence=await repository.findGameCompleteness(game.id);
        if(!evidence || evidence.gameStatus!=="complete") {reusable=false;continue;}
        const [batting,pitching]=await Promise.all([repository.findBattingByGame(game.id),repository.findPitchingByGame(game.id)]);
        if(validateNpbGameFacts(game,evidence.expectedBatters,batting,evidence.expectedPitchers,pitching,
          evidence.mappedBatters,evidence.mappedPitchers).gameStatus!=="complete") reusable=false;
      }
      const days=await client.execute({sql:"SELECT day_status FROM npb_day_runs WHERE target_date=? ORDER BY started_at DESC,run_id DESC LIMIT 1",args:[date]});
      if(reusable && ["complete","no_games"].includes(String(days.rows[0]?.day_status))) {
        reports.push({date,status:"skipped_verified",issues});
      } else {
        // Both schedules have established Game identity/score independently of player detail.
        // Keep that safe metadata even when historical participant detail remains unavailable.
        // Dry-run stages schedules only in the explicitly caller-owned scratch DB.
        await repository.saveGames(games,date,false,true);
        // Preflight before any Player Fact write. Never infer missing pitchers.
        for(const game of games.filter(g=>g.status==="final")) for(const id of [game.homeTeamId,game.awayTeamId]) {
          const team=npbTeams.find(t=>t.id===id)!;
          parseNf3PitchUsage(await session.request(`https://nf3.sakura.ne.jp/${team.group}/${team.code}/t/pc_all_data_last2w_pn.htm`),date,team.code);
        }
        const result=await runNpbDayFacts(client,{targetDate:date,trigger:"repair",dryRun:options.dryRun ?? false,
          requireCompleteGameStage:true,request:session.request,runGame:async(game,request)=>{
            const evidence=await repository.findGameCompleteness(game.id);
            if(evidence?.gameStatus==="complete") {
              const [b,p]=await Promise.all([repository.findBattingByGame(game.id),repository.findPitchingByGame(game.id)]);
              const report=validateNpbGameFacts(game,evidence.expectedBatters,b,evidence.expectedPitchers,p,
                evidence.mappedBatters,evidence.mappedPitchers);
              if(report.gameStatus==="complete") return {report,fetchedPages:0,battingFacts:b.length,pitchingFacts:p.length,
                insertedBatting:0,insertedPitching:0,wouldCreateMappings:[],observed:{sacrificeFlies:0,fractionalTwoOutPitchers:0},nonBattingSubstitutes:[]};
            }
            return runNpbGameProof(client,{gameId:game.id,targetDate:date,dryRun:options.dryRun ?? false,scope:"day-ingest",
              request,persistRawManifest:false});
          }});
        status=result.status;
        reports.push({date,status,issues:result.games.flatMap(g=>g.issues),result});
      }
    } catch(error) {
      issues.push(String(error));
      reports.push({date,status,issues});
    }
    await options.progress?.(reports.at(-1));
  }
  return {from:options.from,to:options.to,dates:dates.length,reports,http:session.metrics,durationMs:performance.now()-started};
}
