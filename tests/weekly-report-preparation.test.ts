import { it,expect,vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { lastCompletedWeek,prepareNpbWeeklyReport } from "../src/data/weekly-report-preparation";
import { NpbWeeklyRangeUnavailable,type NpbWeeklyStage,type readNpbWeekly } from "../src/application/npb-weekly";
import { summarizeWeek } from "../src/domain/weekly-analysis";

function saved(stage:NpbWeeklyStage,week:string):Awaited<ReturnType<typeof readNpbWeekly>> {
  const names=new Map([["npb:team:hawks","テスト球団A"],["npb:team:baystars","テスト球団B"]]);
  const scope={league:"NPB" as const,season:2026,competition:stage==="regular"?"regular" as const:"postseason" as const,...(stage==="regular"?{}:{stage})};
  const summary=summarizeWeek([{id:`npb:game:fixture-${stage}`,date:"2026-10-24",awayId:"npb:team:hawks",homeId:"npb:team:baystars",awayRuns:3,homeRuns:1,status:"final"}],week,names,scope,"partial","partial");
  return {summary,names,weeks:[week],asOf:"2026-10-24",updatedAt:"2026-10-25T00:00:00Z",attribution:"架空の検証fixture",sources:[],missingResults:{current:0,previous:0},playerEvaluation:"gate_closed"};
}
const now=new Date("2026-10-25T15:00:00Z");
it("uses the last completed JST Monday–Sunday, not a rolling seven-day or UTC boundary",()=>{
  expect(lastCompletedWeek(new Date("2026-10-25T14:59:59Z")).from).toBe("2026-10-12");
  expect(lastCompletedWeek(now)).toMatchObject({from:"2026-10-19",to:"2026-10-25"});
  expect(lastCompletedWeek(new Date("2027-01-03T15:00:00Z"))).toMatchObject({from:"2026-12-28",to:"2027-01-03"});
});
it("keeps scopes and unknown source states separate, with reproducible content hashes",async()=>{
  const read=vi.fn(async(stage:NpbWeeklyStage,week:string)=>{if(stage==="regular")throw new NpbWeeklyRangeUnavailable();if(stage==="npb_cs_first")throw Error("Unavailable source");return saved(stage,week);});
  const a=await prepareNpbWeeklyReport(read,now),b=await prepareNpbWeeklyReport(read,new Date("2026-10-28T01:00:00Z"));
  expect(a.status).toBe("REPORT_PREPARED");expect(a).toHaveProperty("contentSha256",b.status==="REPORT_PREPARED"?b.contentSha256:null);
  if(a.status!=="REPORT_PREPARED")throw Error("Expected fixture report");
  expect(a.report.scopes.map(s=>s.status)).toEqual(["OUTSIDE_SAVED_RANGE","UNAVAILABLE","RESULTS_COLLECTED","RESULTS_COLLECTED"]);
  for(const s of a.report.scopes)if(s.status==="RESULTS_COLLECTED"){expect(s.summary.coverage).toBe("partial");expect(s.playerEvaluation).toBe("gate_closed");expect(s.summary.games).toHaveLength(1);}
  expect(a.report).toMatchObject({aiRequests:0,canonicalWrites:0,publiclyAdmitted:false});
});
it("does not relabel unavailable sources as no games and blocks player Gate bypasses",async()=>{
  const absent=await prepareNpbWeeklyReport(async()=>{throw new NpbWeeklyRangeUnavailable();},now);
  expect(absent.status).toBe("NO_NEW_VERIFIED_RESULTS");
  const failed=await prepareNpbWeeklyReport(async()=>{throw Error("Network failure");},now);
  expect(failed.status).toBe("SOURCE_UNAVAILABLE");
  const gated=await prepareNpbWeeklyReport(async(stage,week)=>({...saved(stage,week),hot:{batting:[]}}),now);
  expect(gated.status).toBe("SOURCE_UNAVAILABLE");expect(gated).not.toHaveProperty("report");
});
it("skips unadmitted years and refuses uncompleted or non-Monday selections before reading",async()=>{
  const read=vi.fn();expect((await prepareNpbWeeklyReport(read,new Date("2027-02-01T01:00:00Z"))).status).toBe("NO_ADMITTED_YEAR");
  await expect(prepareNpbWeeklyReport(read,now,"2026-10-26")).rejects.toThrow("completed");
  await expect(prepareNpbWeeklyReport(read,now,"2026-10-20")).rejects.toThrow("Monday");expect(read).not.toHaveBeenCalled();
});
it("schedules statistics only, without model/DB secrets, publication or the AI attempt cache",()=>{
  const body=readFileSync(".github/workflows/weekly-analysis.yml","utf8"),w=parse(body);
  expect(w.on.schedule).toEqual([{cron:"47 23 * * 0"}]);expect(w.permissions).toEqual({contents:"read"});
  expect(body).not.toMatch(/CLOUDFLARE|TURSO|secrets\.|--generate|deploy-pages|\.data\/npb-ai-insights/);
  expect(w.jobs.prepare.steps.find((s:{uses?:string})=>s.uses?.startsWith("actions/upload-artifact"))?.with.path).toBe(".data/weekly-reports/review.json");
});
