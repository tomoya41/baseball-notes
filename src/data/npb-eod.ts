import type { DataClient } from "./database";
import { addDays, jstToday } from "./npb-collector";
import { npbTeams, parseNf3TeamGames, parseNf3Standings, type NpbGame } from "./npb-nf3";
import { reconcileHistoricalSchedules } from "./npb-historical-backfill";
import { NpbRepository } from "./npb-repository";
import { validateNpbGameFacts, runNpbGameProof } from "./npb-game-collector";
import { runNpbDayFacts } from "./npb-day-collector";
import { watchNpbEod } from "../application/npb-eod-watcher";
import { sourceRegistry } from "./source-registry";
import { findNpbRegularSeason } from "./npb-season-metadata";

// Small durable operational records reuse the existing backed-up event ledger.
// No Fact snapshots, persistent derived aggregates, or cache tables.
export async function eodEvent(client:DataClient,kind:string,date:string,payload:unknown):Promise<void> {
  await client.execute({sql:`INSERT INTO permanent_events VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(event_id) DO UPDATE SET payload_json=excluded.payload_json,collected_at=excluded.collected_at`,
    args:[`npb:${kind}:${date}`,kind,date,null,JSON.stringify(payload),"npb-eod",date,new Date().toISOString()]});
}
export async function readEodEvent(client:DataClient,kind:string,date:string):Promise<Record<string,unknown>|null> {
  const r=await client.execute({sql:"SELECT payload_json FROM permanent_events WHERE event_id=?",args:[`npb:${kind}:${date}`]});
  return r.rows[0]?JSON.parse(String(r.rows[0].payload_json)) as Record<string,unknown>:null;
}
export function scheduleRange(mode:"season"|"monthly"|"weekly"|"daily",date:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))throw Error("Invalid schedule date");
  const season=findNpbRegularSeason(date);if(!season)throw Error("Season metadata unavailable");
  if(date>season.endDate)throw Error("Schedule date outside season metadata");
  const from=mode==="season"?season.startDate:date;
  const to=mode==="season"?season.endDate:mode==="monthly"?addDays(date,44):mode==="weekly"?addDays(date,13):date;
  return {from:from<season.startDate?season.startDate:from,to:to>season.endDate?season.endDate:to};
}
function assertProvider() {
  if(process.env.NPB_NF3_ENABLED==="false"||sourceRegistry.find(s=>s.key==="nf3")?.status!=="enabled-limited-public")
    throw Error("nf3 provider disabled");
  if(!jstToday().startsWith("2026-"))throw Error("nf3 current-season alias does not verify another year");
}
export async function discoverNpbSchedules(request:(u:string)=>Promise<string>,codes=npbTeams.map(t=>t.code) as string[]) {
  assertProvider();const pages:NpbGame[][]=[];
  for(const code of codes) {
    const team=npbTeams.find(t=>t.code===code);if(!team)throw Error("Unknown schedule team");
    const url=`https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=${team.group==="Central"?0:1}&mon=0&tm=${code}&vst=all`;
    pages.push(parseNf3TeamGames(await request(url),code,2026,url,new Date().toISOString(),true));
  }
  return pages;
}
export async function syncNpbSchedule(client:DataClient,request:(u:string)=>Promise<string>,range:{from:string;to:string}) {
  const pages=await discoverNpbSchedules(request);
  const games=reconcileHistoricalSchedules(pages);
  for(const g of games)if(pages.flat().filter(n=>n.id===g.id).some(n=>n.scheduledTime!==g.scheduledTime))
    throw Error("Paired schedule start-time conflict");
  const repository=new NpbRepository(client);let changed=0;
  for(let date=range.from;date<=range.to;date=addDays(date,1)) {
    const day=games.filter(g=>g.date===date);
    const prior=await repository.findGamesByDate(date);
    // A disappearing fixture is not a cancellation. Require explicit source status.
    if(prior.some(g=>!day.some(n=>n.id===g.id)))throw Error(`Schedule removal needs explicit evidence: ${date}`);
    if(prior.some(g=>g.status==="final"&&day.some(n=>n.id===g.id&&n.status!=="final")))throw Error("Final schedule regression");
    const changes=await repository.saveGames(day,date,false,true);changed+=changes.inserted+changes.updated;
    await eodEvent(client,"schedule-sync",date,{confirmed:true,gameIds:day.map(g=>g.id),
      timezone:"Asia/Tokyo",provider:"nf3",verifiedAt:new Date().toISOString()});
  }
  return {range,games:games.filter(g=>g.date>=range.from&&g.date<=range.to).length,changed};
}
export async function currentGameComplete(repository:NpbRepository,game:NpbGame):Promise<boolean> {
  const evidence=await repository.findGameCompleteness(game.id);
  if(evidence?.gameStatus!=="complete")return false;
  const [batting,pitching]=await Promise.all([repository.findBattingByGame(game.id),repository.findPitchingByGame(game.id)]);
  return validateNpbGameFacts(game,evidence.expectedBatters,batting,evidence.expectedPitchers,pitching,
    batting.length,pitching.length).gameStatus==="complete";
}
export async function runEodWatcher(client:DataClient,request:(u:string)=>Promise<string>,date:string,now=new Date(),offset=120) {
  if(date>jstToday(now)||!/^2026-\d{2}-\d{2}$/.test(date))throw Error("Invalid EOD date");
  const repository=new NpbRepository(client);
  let dayResult:Awaited<ReturnType<typeof runNpbDayFacts>>|undefined;
  const report=await watchNpbEod({
    games:()=>repository.findGamesByDate(date),
    scheduleConfirmed:async()=>Boolean((await readEodEvent(client,"schedule-sync",date))?.confirmed),
    published:async()=>Boolean(await readEodEvent(client,"eod-published",date)),
    complete:g=>currentGameComplete(repository,g),
    checkStatus:async due=>{
      const ids=new Set(due.flatMap(g=>[g.homeTeamId,g.awayTeamId]));
      const codes=npbTeams.filter(t=>ids.has(t.id)).map(t=>t.code);
      const pages=await discoverNpbSchedules(request,codes);
      const rows=pages.flat().filter(g=>due.some(d=>d.id===g.id));
      const checked=due.map(g=>{
        const pair=rows.filter(n=>n.id===g.id);
        if(pair.length!==2||pair[0]!.status!==pair[1]!.status||pair[0]!.homeScore!==pair[1]!.homeScore||
          pair[0]!.awayScore!==pair[1]!.awayScore||pair[0]!.scheduledTime!==pair[1]!.scheduledTime)
          throw Error("Inconsistent paired status source");
        if(g.status==="final"&&pair[0]!.status!=="final")throw Error("Final status regression");
        return pair[0]!;
      });
      await repository.saveGames(checked,date,false,false);
      return checked;
    },
    collect:async game=>{
      const result=await runNpbGameProof(client,{gameId:game.id,targetDate:date,scope:"day-ingest",
        allowCurrentDayFinal:true,request,persistRawManifest:false});
      return result.report.gameStatus==="complete";
    },
    finalize:async games=>{
      // Reconcile today's whole schedule once before finalizing: catch added fixtures.
      const sourceGames=reconcileHistoricalSchedules(await discoverNpbSchedules(request)).filter(g=>g.date===date);
      if(sourceGames.length!==games.length||games.some(g=>!sourceGames.some(n=>n.id===g.id&&n.status===g.status&&
        n.homeScore===g.homeScore&&n.awayScore===g.awayScore)))throw Error("Day schedule changed during finalization");
      await repository.saveGames(sourceGames,date,false,true);
      dayResult=await runNpbDayFacts(client,{targetDate:date,trigger:"manual",allowCurrentDayFinal:true,
        reuseCompleteGames:true,request,requireCompleteGameStage:true});
      if(!["complete","no_games"].includes(dayResult.status))return false;
      return true;
    },
  },now,offset);
  return {...report,date,dayResult};
}

// Undated nf3 standings are not stamped as today just because a clock says so.
// Verify every W/L/T against the independently paired canonical source schedule.
export async function captureEodStandings(client:DataClient,request:(u:string)=>Promise<string>,date:string) {
  const games=reconcileHistoricalSchedules(await discoverNpbSchedules(request)).filter(g=>g.date<=date&&g.status==="final");
  const rows=parseNf3Standings(await request("https://nf3.sakura.ne.jp/"),date,new Date().toISOString());
  for(const row of rows) {
    let wins=0,losses=0,ties=0;
    for(const game of games.filter(g=>g.homeTeamId===row.teamId||g.awayTeamId===row.teamId)) {
      const own=game.homeTeamId===row.teamId?game.homeScore:game.awayScore;
      const other=game.homeTeamId===row.teamId?game.awayScore:game.homeScore;
      if(own===null||other===null)throw Error("Missing final score");
      if(own>other)wins++;else if(own<other)losses++;else ties++;
    }
    if(row.wins!==wins||row.losses!==losses||row.ties!==ties)throw Error("Standings have not caught up to EOD schedule");
  }
  await new NpbRepository(client).saveStandings(rows,false);
}
