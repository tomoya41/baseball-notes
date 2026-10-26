import { it,expect } from "vitest";
import { calendarMonth,collectedMonths } from "../src/domain/weekly-analysis";
import { readMlbWeekly } from "../src/application/mlb-weekly";
import { readNpbWeekly } from "../src/application/npb-weekly";
import { weeklyFixture } from "./fixtures/weekly-analysis";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink } from "../src/domain/native-navigation";

it("uses complete calendar months, leap days and year boundaries rather than 30-day windows",()=>{
 expect(calendarMonth("2024-03-15")).toEqual({from:"2024-03-01",to:"2024-03-31",previous:{from:"2024-02-01",to:"2024-02-29"}});
 expect(calendarMonth("2025-01-01").previous).toEqual({from:"2024-12-01",to:"2024-12-31"});
 expect(collectedMonths("2025-03-27","2025-10-08")).toHaveLength(8);
 expect(()=>calendarMonth("2025-02-29")).toThrow();
});
it("reuses verified MLB daily facts and monthly sample thresholds without averaging rates",async()=>{
 const f=weeklyFixture();const report=await readMlbWeekly(f.manifest,2025,"2025-09-17","regular",f.read,"month");
 expect(report.summary.week).toMatchObject({from:"2025-09-01",to:"2025-09-30"});
 expect(report.summary.games).toHaveLength(30);expect(report.summary.teams[0]).toMatchObject({games:30,wins:30,runsFor:120,runsAgainst:90,previous:null});
 expect(report.hot.batting).toHaveLength(1);expect(report.hot.batting[0]!.metrics.PA?.value).toBe(120);
 expect(report.hot.batting[0]!.metrics.H?.value).toBe(48);expect(report.hot.batting[0]!.metrics.AVG?.value).toBe(.4);
 expect(report.hot.batting.some(e=>e.playerId===f.ids[3])).toBe(false);expect(report.hot.starters).toHaveLength(1);expect(report.hot.relievers).toHaveLength(1);
 expect(report.rising).toEqual([]);expect(report.fetches).toBe(34);
});
it("does not use monthly player eligibility for Postseason or promote an incomplete month",async()=>{
 const f=weeklyFixture("postseason"),r=await readMlbWeekly(f.manifest,2025,"2025-09-01","postseason",f.read,"month");
 expect(r.summary.games).toHaveLength(30);expect(r.summary.scope.competition).toBe("postseason");expect(r.playerEvaluation).not.toBe("available");expect(r.hot.batting).toEqual([]);
 const g=weeklyFixture();g.index.firstDate="2025-09-02";g.manifest.seasons[0]!.firstDate="2025-09-02";
 await expect(readMlbWeekly(g.manifest,2025,"2025-09-01","regular",g.read,"month")).rejects.toThrow();
});
it("bounds NPB reads to two calendar months and four concurrent requests; missing days remain partial",async()=>{
 let calls=0,active=0,maximum=0;const dates:string[]=[];
 const surface={manifest:async()=>({schemaVersion:1 as const,league:"NPB" as const,from:"2026-01-01",to:"2026-12-31",effectiveDate:"2026-09-30",generatedAt:"2026-10-01T00:00:00Z"}),date:async(date:string)=>{
  calls++;active++;maximum=Math.max(maximum,active);dates.push(date);await Promise.resolve();active--;
  if(date==="2026-09-05")throw Error("not acquired");
  return {schemaVersion:1 as const,league:"NPB" as const,date,generatedAt:"2026-10-01T00:00:00Z",coverage:"no_games" as const,games:[]};
 }};
 const report=await readNpbWeekly("regular","2026-09-01",surface,undefined,"month");
 expect(calls).toBe(61);expect(maximum).toBeLessThanOrEqual(4);expect(dates[0]).toBe("2026-08-01");expect(dates.at(-1)).toBe("2026-09-30");
 expect(report.summary.coverage).toBe("partial");expect(report.summary.previousCoverage).toBe("complete");expect(report.playerEvaluation).toBe("gate_closed");expect("hot" in report).toBe(false);
});
it("shares canonical month URLs, strips unrelated parameters and keeps scopes distinct",()=>{
 const route=portableRoute("/MLB/monthly","season=2025&month=2025-09&competition=postseason&secret=hidden");
 expect(route).toBe("/MLB/monthly?season=2025&month=2025-09&competition=postseason");expect(canonicalDeepLink(`baseballnotes://MLB/monthly?${route!.split("?")[1]}`)).toBe(route);
 expect(portableRoute("/MLB/monthly","season=2026")).toBeNull();expect(portableRoute("/NPB/monthly","month=2026-13")).toBeNull();
 expect(portableRoute("/NPB/monthly","stage=japan_series&competition=regular")).toBeNull();
});
