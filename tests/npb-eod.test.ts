import { afterEach, expect, test, vi } from "vitest";
import { monitorAfter, watchNpbEod, type EodWatcherPort } from "../src/application/npb-eod-watcher";
import { scheduleObservation } from "../src/application/npb-schedule-observability";
import { scheduleRange, eodEvent, runEodWatcher } from "../src/data/npb-eod";
import { createNf3DryRunSession } from "../src/data/npb-day-dry-run";
import { hasPlausibleFinalOuts } from "../src/data/npb-game-collector";
import { shortenedFinalEvidenceSchema } from "../src/domain/npb-game-completion";
import type { NpbGame } from "../src/data/npb-nf3";
import { parseNf3TeamGames } from "../src/data/npb-nf3";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDataClient, migrateData } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";

const game=(id="day",time="13:00",status:NpbGame["status"]="scheduled"):NpbGame=>({
  id,date:"2026-09-27",season:2026,scheduledTime:time,homeTeamId:"home",awayTeamId:"away",
  status,homeScore:status==="final"?2:null,awayScore:status==="final"?1:null,gameNumber:1,
  venue:null,sourceKey:"nf3",sourceRecordId:id,sourceUrl:"https://nf3.sakura.ne.jp/",collectedAt:"2026-09-27T00:00:00Z",
});
function fixture(games:NpbGame[],checked=games,complete=false) {
  const port:EodWatcherPort={games:vi.fn(async()=>games),scheduleConfirmed:vi.fn(async()=>true),
    published:vi.fn(async()=>false),complete:vi.fn(async()=>complete),checkStatus:vi.fn(async()=>checked),
    collect:vi.fn(async()=>true),finalize:vi.fn(async()=>true)};
  return port;
}
const now=(time:string)=>new Date(`2026-09-27T${time}:00+09:00`);
afterEach(()=>vi.unstubAllGlobals());

test("JST monitoring uses each game's start plus configurable offset",()=>{
  expect(monitorAfter(game())?.toISOString()).toBe("2026-09-27T06:00:00.000Z");
  expect(monitorAfter(game("night","18:00"))?.toISOString()).toBe("2026-09-27T11:00:00.000Z");
  expect(monitorAfter(game(),60)?.toISOString()).toBe("2026-09-27T05:00:00.000Z");
  expect(monitorAfter({...game(),scheduledTime:null})).toBeNull();
  expect(monitorAfter(game("invalid","25:00"))).toBeNull();
  expect(()=>monitorAfter(game(),-1)).toThrow();
});
test.each(["14:17","14:59"])("day game before monitorAfter %s has zero source requests",async time=>{
  const p=fixture([game()]);expect((await watchNpbEod(p,now(time))).mode).toBe("no-op");
  expect(p.checkStatus).not.toHaveBeenCalled();expect(p.collect).not.toHaveBeenCalled();
});
test.each(["15:00","15:17"])("ongoing at %s checks status but never full-collects",async time=>{
  const p=fixture([game()]);const r=await watchNpbEod(p,now(time));expect(r.monitoredGames).toBe(1);
  expect(p.collect).not.toHaveBeenCalled();expect(r.publishRequired).toBe(false);
});
test("new final at 16:17 collects and finalizes once",async()=>{
  const p=fixture([game()],[game("day","13:00","final")]);
  expect(await watchNpbEod(p,now("16:17"))).toMatchObject({fullCollectionGames:1,publishRequired:true});
  expect(p.finalize).toHaveBeenCalledTimes(1);
  p.published=vi.fn(async()=>true);
  expect((await watchNpbEod(p,now("17:17"))).reason).toBe("already_published");
  expect(p.collect).toHaveBeenCalledTimes(1);
});
test("night fixture checks after 20:00 and collects only final",async()=>{
  const night=game("night","18:00");const p=fixture([night]);
  expect((await watchNpbEod(p,now("19:17"))).mode).toBe("no-op");
  expect((await watchNpbEod(p,now("20:17"))).fullCollectionGames).toBe(0);
  p.checkStatus=vi.fn(async()=>[{...night,status:"final" as const,homeScore:2,awayScore:1}]);
  expect((await watchNpbEod(p,now("21:17"))).publishRequired).toBe(true);
});
test("mixed day/night saves day-game Facts without early Day publish",async()=>{
  const p=fixture([game(),game("night","18:00")],[game("day","13:00","final")]);
  expect(await watchNpbEod(p,now("16:17"))).toMatchObject({fullCollectionGames:1,publishRequired:false});
  expect(p.finalize).not.toHaveBeenCalled();
});
test("several finals and doubleheader retain Game identity",async()=>{
  const games=[game("first"),{...game("second","14:00"),gameNumber:2}];
  const p=fixture(games,games.map(g=>({...g,status:"final",homeScore:2,awayScore:1})));
  expect(await watchNpbEod(p,now("17:17"))).toMatchObject({fullCollectionGames:2,publishRequired:true});
});
test.each(["postponed","canceled"] as const)("%s is terminal without full collection",async status=>{
  const p=fixture([game()],[game("day","13:00",status)]);
  expect((await watchNpbEod(p,now("16:17"))).publishRequired).toBe(true);
  expect(p.collect).not.toHaveBeenCalled();
});
test("rain delay remains ongoing, changed start is not hardcoded",async()=>{
  const p=fixture([game()],[game("day","18:00")]);
  expect((await watchNpbEod(p,now("16:17"))).publishRequired).toBe(false);
  p.games=vi.fn(async()=>[game("day","18:00")]);
  expect((await watchNpbEod(p,now("19:17"))).mode).toBe("no-op");
});
test("complete current Facts from Daily or earlier Watcher skip full details",async()=>{
  const p=fixture([game("day","13:00","final")],[],true);
  expect((await watchNpbEod(p,now("18:17"))).publishRequired).toBe(true);
  expect(p.checkStatus).not.toHaveBeenCalled();expect(p.collect).not.toHaveBeenCalled();
});
test("failed or partial final never finalizes",async()=>{
  const p=fixture([game()],[game("day","13:00","final")]);p.collect=vi.fn(async()=>false);
  expect((await watchNpbEod(p,now("16:17"))).publishRequired).toBe(false);
  expect(p.finalize).not.toHaveBeenCalled();
});
test("source omission/duplicates/failure cannot complete the day",async()=>{
  const p=fixture([game()],[]);await expect(watchNpbEod(p,now("16:17"))).rejects.toThrow("Incomplete");
  p.checkStatus=vi.fn(async()=>{throw Error("temporary failure");});
  await expect(watchNpbEod(p,now("16:17"))).rejects.toThrow("temporary");expect(p.finalize).not.toHaveBeenCalled();
});
test("confirmed no-games and unconfirmed schedule require no source check",async()=>{
  const p=fixture([]);expect((await watchNpbEod(p,now("16:17"))).reason).toBe("confirmed_no_games");
  p.scheduleConfirmed=vi.fn(async()=>false);
  expect((await watchNpbEod(p,now("16:17"))).reason).toBe("schedule_not_confirmed");
  expect(p.checkStatus).not.toHaveBeenCalled();
});
test("normal/extra finals unchanged, short outs alone rejected",()=>{
  const g=game("g","13:00","final");
  expect(hasPlausibleFinalOuts(g,27,24)).toBe(true);
  expect(hasPlausibleFinalOuts(g,30,28)).toBe(true);
  expect(hasPlausibleFinalOuts(g,18,18)).toBe(false);
});
test("independent shortened-final evidence verifies exact ending, teams and score",()=>{
  const g=game("g","13:00","final");const e=shortenedFinalEvidenceSchema.parse({gameId:g.id,provider:"nf3",
    observedStatus:"officially_shortened_final",observedFinalInning:6,homeTeamId:g.homeTeamId,awayTeamId:g.awayTeamId,
    homeScore:2,awayScore:1,homePitchingOuts:18,awayPitchingOuts:18,sourceUrl:g.sourceUrl,verifiedAt:g.collectedAt});
  expect(hasPlausibleFinalOuts({...g,completionEvidence:e},18,18)).toBe(true);
  expect(hasPlausibleFinalOuts({...g,completionEvidence:e},18,17)).toBe(false);
  expect(hasPlausibleFinalOuts({...g,homeScore:3,completionEvidence:e},18,18)).toBe(false);
  expect(hasPlausibleFinalOuts({...g,completionEvidence:{...e,homeTeamId:"other"}},18,18)).toBe(false);
  expect(shortenedFinalEvidenceSchema.safeParse({...e,observedFinalInning:null}).success).toBe(false);
});
test("season/month/week/day sync share metadata range and clamp future end",()=>{
  expect(scheduleRange("season","2026-09-27")).toEqual({from:"2026-03-27",to:"2026-10-07"});
  expect(scheduleRange("monthly","2026-09-27").to).toBe("2026-10-07");
  expect(scheduleRange("weekly","2026-04-01").to).toBe("2026-04-14");
  expect(scheduleRange("daily","2026-09-27").to).toBe("2026-09-27");
  expect(()=>scheduleRange("daily","2026-11-01")).toThrow();
});
test("scheduled clock distinguishes JST expected slot and runner delay lower-bound",()=>{
  const r=scheduleObservation({workflowName:"Watcher",cron:"17 * * * *",runCreatedAt:"2026-09-27T06:20:00Z",
    runnerStartedAt:"2026-09-27T06:25:00Z",targetDate:"2026-09-27"});
  expect(r).toMatchObject({expectedScheduledAt:"2026-09-27T06:17:00.000Z",delayMinutes:8,timezone:"Asia/Tokyo",
    delayIsLowerBound:true,runCreationToRunnerMinutes:5});
  expect(scheduleObservation({...{workflowName:"Daily",cron:"37 18 * * *",runCreatedAt:"2026-09-26T21:29:00Z",
    runnerStartedAt:"2026-09-26T21:30:00Z",targetDate:"2026-09-26"},timezone:"UTC"}).delayMinutes).toBe(173);
});
test("one Run deduplicates Source pages and never retries permanent HTTP failure",async()=>{
  const fetcher=vi.fn(async()=>new Response("page"));vi.stubGlobal("fetch",fetcher);
  const session=createNf3DryRunSession(0);const url="https://nf3.sakura.ne.jp/";
  await session.request(url);await session.request(url);
  expect(session.metrics).toMatchObject({httpRequests:1,cacheHits:1,retries:0});
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("missing",{status:404})));
  const permanent=createNf3DryRunSession(0);await expect(permanent.request(url)).rejects.toThrow("HTTP 404");
  expect(permanent.metrics).toMatchObject({httpRequests:1,retries:0});
});
test("Watcher schedule parser requires an explicit result marker, not score alone",()=>{
  const html=readFileSync("tests/fixtures/nf3/games.html","utf8");
  const rows=parseNf3TeamGames(html,"T",2026,"https://nf3.sakura.ne.jp/","2026-09-27T00:00:00Z",true);
  expect(rows.some(g=>g.status==="final")).toBe(true);
  const lacking=html.replaceAll("○","").replaceAll("●","").replaceAll("△","");
  expect(parseNf3TeamGames(lacking,"T",2026,"https://nf3.sakura.ne.jp/","2026-09-27T00:00:00Z",true)
    .filter(g=>g.homeScore!==null).every(g=>g.status==="unknown")).toBe(true);
});
test("independent evidence survives canonical repository read and rejects mismatched header",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"eod-evidence-")),client=openDataClient(`file:${join(dir,"data.db")}`);
  try {
    await migrateData(client);const repo=new NpbRepository(client),g=game("short","13:00","final");
    await repo.saveGames([g],g.date,false,true);
    const spy=vi.spyOn(client,"batch");
    await repo.saveGames([g],g.date,false,false,{preserveEnumeration:true});
    expect(spy).not.toHaveBeenCalled();
    expect((await repo.findStageStatuses(g.date)).games).toBe("complete");spy.mockRestore();
    const e=shortenedFinalEvidenceSchema.parse({gameId:g.id,provider:"nf3",observedStatus:"officially_shortened_final",
      observedFinalInning:6,homeTeamId:g.homeTeamId,awayTeamId:g.awayTeamId,homeScore:2,awayScore:1,
      homePitchingOuts:18,awayPitchingOuts:18,sourceUrl:g.sourceUrl,verifiedAt:g.collectedAt});
    await repo.saveShortenedFinalEvidence(e);await repo.saveShortenedFinalEvidence(e);
    expect((await repo.findGamesByDate(g.date))[0]?.completionEvidence).toEqual(e);
    expect(Number((await client.execute("SELECT COUNT(*) AS n FROM permanent_events")).rows[0]?.n)).toBe(1);
    await expect(repo.saveShortenedFinalEvidence({...e,homeScore:99})).rejects.toThrow("canonical Game");
    expect(Number((await client.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n)).toBe(0);
  } finally {client.close();}
});
test("transient failure retries once, never unbounded",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response("error",{status:503})).mockResolvedValueOnce(new Response("ok"));
  vi.stubGlobal("fetch",fetcher);const session=createNf3DryRunSession(0);
  expect(await session.request("https://nf3.sakura.ne.jp/")).toBe("ok");
  expect(session.metrics).toMatchObject({httpRequests:2,retries:1});
});
test("one Game's collection error preserves other Game but blocks Day publication",async()=>{
  const games=[game("one"),game("two")],final=games.map(g=>({...g,status:"final" as const,homeScore:2,awayScore:1}));
  const p=fixture(games,final);p.collect=vi.fn(async g=>{if(g.id==="one")throw Error("identity unresolved");return true;});
  expect(await watchNpbEod(p,now("16:17"))).toMatchObject({fullCollectionGames:2,failedCollectionGames:1,publishRequired:false});
  expect(p.collect).toHaveBeenCalledTimes(2);expect(p.finalize).not.toHaveBeenCalled();
});
test("future weekly no-games evidence cannot replace today's confirmation",async()=>{
  const client=openDataClient("file::memory:");
  try {
    await migrateData(client);const request=vi.fn(async()=>{throw Error("Source must not be accessed");});
    await eodEvent(client,"schedule-sync","2026-09-27",{confirmed:true,gameIds:[],verifiedAt:"2026-09-26T00:00:00Z"});
    expect((await runEodWatcher(client,request,"2026-09-27",now("16:17"))).reason).toBe("schedule_not_confirmed");
    await eodEvent(client,"schedule-sync","2026-09-27",{confirmed:true,gameIds:[],verifiedAt:"2026-09-27T00:00:00Z"});
    const writes=vi.spyOn(client,"batch");
    expect((await runEodWatcher(client,request,"2026-09-27",now("16:17"))).reason).toBe("confirmed_no_games");
    expect(request).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();
  } finally {client.close();}
});
