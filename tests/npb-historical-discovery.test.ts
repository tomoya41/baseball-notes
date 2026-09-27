import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createHistoricalPitcherDiscovery, historicalReasonCodes } from "../src/data/npb-historical-discovery";
import { findRosterPlayer,mergeNf3ParticipantProfiles,nf3ProfileParameter, parseNf3BattingRoster, parseNf3PitchingRoster } from "../src/data/npb-game-source";
import { parseNf3TeamGames, type NpbGame } from "../src/data/npb-nf3";
const fixture=(name:string)=>readFileSync(new URL(`./fixtures/npb-game/${name}.html`,import.meta.url),"utf8");
describe("published historical season participant route",()=>{
  it("merges the observed withdrawn Duplantier f/p profiles only by the same exact provider identity",()=>{
    const batter={number:"0",name:"デュプランティエ",profileUrl:"https://nf3.sakura.ne.jp/Central/DB/f/wb_0_stat.htm"};
    const pitcher={...batter,profileUrl:batter.profileUrl.replace("/f/","/p/")};
    expect(mergeNf3ParticipantProfiles([batter],[pitcher],"DB")).toEqual([batter]);
    expect(()=>mergeNf3ParticipantProfiles([batter],[{...pitcher,name:"別人"}],"DB")).toThrow("Conflicting");
    const differentId={...pitcher,number:"20",profileUrl:"https://nf3.sakura.ne.jp/Central/DB/p/20_stat.htm"};
    const ambiguous=mergeNf3ParticipantProfiles([batter],[differentId],"DB");
    expect(ambiguous).toHaveLength(2);
    expect(()=>findRosterPlayer(ambiguous,batter.name)).toThrow("ambiguous");
  });
  it("enumerates old March games from the observed 全表示 schedule",()=>{
    const games=parseNf3TeamGames(fixture("schedule-e-march-all"),"E",2026,"https://nf3.sakura.ne.jp/",new Date().toISOString());
    expect(games.map(g=>g.date)).toEqual(["2026-03-27","2026-03-28","2026-03-29","2026-03-31"]);
    expect(games[0]).toMatchObject({status:"final",awayScore:10,homeScore:0});
  });
  it("keeps observed uniform reuse separate while merging each exact historical f/p pair",()=>{
    const players=[
      {number:"42",name:"ビド",profileUrl:"https://nf3.sakura.ne.jp/Central/DB/f/42_stat.htm"},
      {number:"42",name:"コックス",profileUrl:"https://nf3.sakura.ne.jp/Central/DB/f/wb_42_stat.htm"},
    ];
    expect(mergeNf3ParticipantProfiles(players,players.map(p=>({...p,profileUrl:p.profileUrl.replace("/f/","/p/")})),"DB")).toEqual(players);
    expect(findRosterPlayer(players,"コックス").profileUrl).toContain("wb_42");
    const hawks=[
      {number:"39",name:"山本祐大",profileUrl:"https://nf3.sakura.ne.jp/Pacific/H/f/39_stat.htm"},
      {number:"39",name:"尾形崇斗",profileUrl:"https://nf3.sakura.ne.jp/Pacific/H/f/tr_DB_39_stat.htm"},
    ];
    expect(mergeNf3ParticipantProfiles(hawks,[{...hawks[1]!,profileUrl:hawks[1]!.profileUrl.replace("/f/","/p/")}],"H")).toEqual(hawks);
  });
  const game={date:"2026-09-23",homeTeamId:"npb:team:eagles",awayTeamId:"npb:team:buffaloes",scheduledTime:"17:00"} as NpbGame;
  it("validates a season pitcher roster and source profile identity",()=>{
    expect(parseNf3PitchingRoster(fixture("roster-pitching-e"),"E")).toEqual([
      {number:"21",name:"早川隆久",profileUrl:"https://nf3.sakura.ne.jp/Pacific/E/p/21_stat.htm"}]);
    expect(()=>parseNf3PitchingRoster(fixture("roster-pitching-e").replace("Pacific/E/p","Pacific/H/p"),"E")).toThrow();
  });
  it("retains observed traded/withdrawn rows without hover attributes and exact source IDs",()=>{
    const roster=parseNf3BattingRoster(fixture("roster-db-historical"),"DB");
    const yamamoto=roster.find(p=>p.name==="山本祐大")!;
    const viciedo=roster.find(p=>p.name==="ビシエド")!;
    expect(nf3ProfileParameter(yamamoto.profileUrl,"DB",yamamoto.number)).toBe("tr_H_50");
    expect(nf3ProfileParameter(viciedo.profileUrl,"DB",viciedo.number)).toBe("wb_66");
    expect(()=>nf3ProfileParameter(yamamoto.profileUrl,"H","50")).toThrow();
  });
  it("fetches roster/logs once, uses exact date/opponent/time and preserves zero outs",async()=>{
    const request=vi.fn(async(url:string)=>new URL(url).searchParams.has("pcnum")?
      fixture("pitching-m18").replaceAll("ロッテ","楽天"):fixture("roster-pitching-e"));
    const discover=createHistoricalPitcherDiscovery(request);
    const pitchers=await discover(game,game.homeTeamId);
    expect(pitchers).toHaveLength(1);
    expect(await discover(game,game.homeTeamId)).toEqual(pitchers);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![0]).toContain("mon=0");
    await expect(discover({...game,scheduledTime:"14:00"},game.homeTeamId)).rejects.toThrow("unavailable");
  });
  it("classifies failures without turning parser/network errors into no games",()=>{
    expect(historicalReasonCodes(["nf3 games page has no games"])).toEqual(["schedule_enumeration_failure"]);
    expect(historicalReasonCodes(["Unresolved possible existing/transferred player", "Check failed: plateAppearances"])).toEqual(["identity_unresolved","validation_failure"]);
    expect(historicalReasonCodes(["Network failure HTTP 503"])).toEqual(["source_unavailable"]);
  });
});

