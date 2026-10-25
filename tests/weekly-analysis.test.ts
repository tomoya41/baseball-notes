import { describe,it,expect } from "vitest";
import { calendarWeek,collectedWeeks,summarizeWeek,type WeeklyGame } from "../src/domain/weekly-analysis";
import { readMlbWeekly } from "../src/application/mlb-weekly";
import { readNpbWeekly } from "../src/application/npb-weekly";
import { weeklyFixture } from "./fixtures/weekly-analysis";
import { canonicalDeepLink } from "../src/domain/native-navigation";
import { portableRoute } from "../src/domain/product-sharing";

describe("calendar week and saved-scope analysis",()=>{
  it("uses Monday through Sunday and adjacent equal prior weeks across leap days/year changes",()=>{
    expect(calendarWeek("2024-02-29")).toEqual({from:"2024-02-26",to:"2024-03-03",previous:{from:"2024-02-19",to:"2024-02-25"}});
    expect(calendarWeek("2026-01-01").from).toBe("2025-12-29");expect(calendarWeek("2025-09-28").from).toBe("2025-09-22");
    expect(()=>calendarWeek("2025-02-29")).toThrow();expect(collectedWeeks("2025-09-01","2025-09-30")).toHaveLength(5);
  });
  it("computes real counting totals/rates without averaging player or team rates",async()=>{
    const f=weeklyFixture(),r=await readMlbWeekly(f.manifest,2025,"2025-09-22","regular",f.read);
    expect(r.summary.games).toHaveLength(7);expect(r.summary.closeGames).toBe(7);expect(r.summary.teams.find(t=>t.teamId===f.home)).toMatchObject({wins:7,losses:0,runsFor:28,runsAgainst:21,runsPerGame:4});
    const b=r.hot.batting[0]!;expect(b.playerId).toBe(f.ids[0]);expect(b.metrics.PA?.value).toBe(28);expect(b.metrics.H?.value).toBe(21);expect(b.metrics.OPS?.value).toBe(2.25);
    expect(b.previous).toBe(1.25);expect(b.delta).toBe(1);expect(r.rising.some(e=>e.playerId===f.ids[0])).toBe(true);
    expect(r.hot.batting.some(e=>e.playerId===f.ids[3])).toBe(false);expect(r.hot.starters[0]?.metrics.outsRecorded?.value).toBe(126);expect(r.hot.relievers[0]?.metrics.outsRecorded?.value).toBe(42);
    expect(r.fetches).toBe(18);
  });
  it("rejects missing/duplicate schedule games, changed fingerprints and cross-competition payloads",async()=>{
    const f=weeklyFixture(),path="schedule/2025/2025-09-22.json",day=f.payloads.get(path) as {games:unknown[]};day.games=[];
    await expect(readMlbWeekly(f.manifest,2025,"2025-09-22","regular",f.read)).rejects.toThrow("chronology");
    const g=weeklyFixture();g.month.sourceFingerprint="f".repeat(64);await expect(readMlbWeekly(g.manifest,2025,"2025-09-22","regular",g.read)).rejects.toThrow("scope");
    const h=weeklyFixture();h.index.competitionType="postseason";await expect(readMlbWeekly(h.manifest,2025,"2025-09-22","regular",h.read)).rejects.toThrow("scope");
  });
  it("keeps boundary weeks and partial coverage out of player HOT/changes",async()=>{
    const f=weeklyFixture(),last=await readMlbWeekly(f.manifest,2025,"2025-09-29","regular",f.read);
    expect(last.summary.coverage).toBe("partial");expect(last.summary.games).toHaveLength(2);expect(last.hot.batting).toEqual([]);
    f.index.coverage="partial";f.manifest.seasons[0]!.coverage="partial";
    const r=await readMlbWeekly(f.manifest,2025,"2025-09-22","regular",f.read);expect(r.hot.starters).toEqual([]);expect(r.rising).toEqual([]);
  });
  it("uses only the selected Postseason files without leaking Regular data",async()=>{
    const f=weeklyFixture("postseason"),r=await readMlbWeekly(f.manifest,2025,"2025-09-22","postseason",f.read);
    expect(r.summary.scope.competition).toBe("postseason");expect(r.hot.batting).toHaveLength(1);
    await expect(readMlbWeekly(f.manifest,2026,"2026-09-22","regular",f.read)).rejects.toThrow("unavailable");
  });
  it("describes explicit inning scoring, not a fabricated causal turning point or unplayed half",()=>{
    const f=weeklyFixture(),names=new Map([[f.home,"ホーム"],[f.away,"ビジター"]]),g:WeeklyGame={id:f.games[0]!.id,date:"2025-09-22",homeId:f.home,awayId:f.away,homeRuns:3,awayRuns:1,status:"final",innings:{away:[0,0,0,0,0,0,0,0,1],home:[0,0,0,0,0,3,0,0,0],homeLastInning:"not_played"}};
    const r=summarizeWeek([g],g.date,names,{league:"MLB",season:2025,competition:"postseason"},"partial","partial");
    expect(r.innings).toEqual([{gameId:g.id,teamId:f.home,inning:6,half:"裏",runs:3}]);expect(r.teams.every(t=>t.previous===null)).toBe(true);
    expect(()=>summarizeWeek([g,g],g.date,names,r.scope,"partial","partial")).toThrow();
  });
  it("does not synthesize a missing NPB day or treat score-only partial data as complete",async()=>{
    const empty=(date:string)=>({schemaVersion:1 as const,league:"NPB" as const,date,generatedAt:"2026-10-01T00:00:00Z",coverage:"no_games" as const,games:[]});
    const surface={manifest:async()=>({schemaVersion:1 as const,league:"NPB" as const,from:"2026-09-01",to:"2026-09-30",effectiveDate:"2026-09-30",generatedAt:"2026-10-01T00:00:00Z"}),date:async(date:string)=>{if(date==="2026-09-23")throw Error("not collected");return empty(date);}};
    const r=await readNpbWeekly("regular","2026-09-21",surface);expect(r.summary.coverage).toBe("partial");expect(r.summary.games).toEqual([]);expect(r.playerEvaluation).toBe("gate_closed");expect("hot" in r).toBe(false);
  });
  it("shares/restores scoped weeks without carrying a foreign year or arbitrary parameters",()=>{
    const route=portableRoute("/MLB/weekly","season=2025&week=2025-09-22&competition=postseason&secret=hidden");
    expect(route).toBe("/MLB/weekly?season=2025&week=2025-09-22&competition=postseason");expect(canonicalDeepLink(`baseballnotes://MLB/weekly?${route!.split("?")[1]}`)).toBe(route);
    expect(portableRoute("/NPB/weekly","stage=japan_series&competition=regular")).toBeNull();expect(portableRoute("/MLB/weekly","season=2026")).toBeNull();
  });
});
