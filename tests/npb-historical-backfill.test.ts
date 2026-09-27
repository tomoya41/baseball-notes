import { describe, expect, it } from "vitest";
import { backfillDates, reconcileHistoricalSchedules, runHistoricalBackfill } from "../src/data/npb-historical-backfill";
import type { NpbGame } from "../src/data/npb-nf3";
import type { DataClient } from "../src/data/database";

const now=new Date("2026-09-27T00:00:00Z");
describe("historical range safety",()=>{
  it("uses only completed season dates, excluding eleven future dates",()=>{
    expect(backfillDates("2026-03-27","2026-09-26",now)).toHaveLength(184);
    expect(()=>backfillDates("2026-03-27","2026-09-27",now)).toThrow();
    expect(()=>backfillDates("2026-03-26","2026-09-26",now)).toThrow();
    expect(()=>backfillDates("2026-04-31","2026-05-01",now)).toThrow();
  });
  it("requires explicit scratch ownership for dry-run before any read or mutation",async()=>{
    await expect(runHistoricalBackfill({} as DataClient,{from:"2026-09-20",to:"2026-09-20",dryRun:true,now}))
      .rejects.toThrow("scratch");
  });
});
describe("dual-source schedule reconciliation",()=>{
  const game={id:"game",date:"2026-09-20",status:"final",homeTeamId:"h",awayTeamId:"a",homeScore:1,awayScore:0} as NpbGame;
  const pages=(a=game,b=game)=>[[a],[b],...Array.from({length:10},()=>[])];
  it("requires all twelve parsed monthly schedules before confirming no games",()=>{
    expect(reconcileHistoricalSchedules(Array.from({length:12},()=>[]))).toEqual([]);
    expect(()=>reconcileHistoricalSchedules([])).toThrow();
  });
  it("rejects a one-sided game and mismatching scores",()=>{
    expect(()=>reconcileHistoricalSchedules([[game],...Array.from({length:11},()=>[])])).toThrow();
    expect(()=>reconcileHistoricalSchedules(pages(game,{...game,homeScore:2}))).toThrow();
  });
  it("keeps doubleheaders distinct and stable",()=>{
    const second={...game,id:"second",gameNumber:2};
    expect(reconcileHistoricalSchedules([[second,game],[game,second],...Array.from({length:10},()=>[])])
      .map(g=>g.id)).toEqual(["game","second"]);
  });
});
