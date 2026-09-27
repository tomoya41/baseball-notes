import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerPeriodBatchService } from "../src/application/player-period-batch";
import { buildNpbSeasonPayload, npbSeasonPayloadSchema, seasonRankingReadModel } from "../src/application/npb-season-payload";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";
import { aggregateBatting, aggregatePitching } from "../src/domain/player-period";
import { findNpbRegularSeason } from "../src/data/npb-season-metadata";
import { evaluatePeriodCoverage } from "../src/domain/period-coverage";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import { PlayerSeasonView } from "../src/ui/player-season";

const date="2026-09-26",at="2026-09-27T00:00:00.000Z";
const common={gameId:"g",playerId:"dual",teamId:"t",opponentTeamId:"other",sourceKey:"nf3",sourceRecordId:"private",collectedAt:at};
const batting=playerGameBattingSchema.parse({...common,battingOrder:3,pa:3,ab:2,runs:0,hits:1,doubles:0,triples:0,homeRuns:0,
  rbi:0,walks:1,hbp:0,sacrificeHits:0,sacrificeFlies:0,strikeouts:1,stolenBases:0,caughtStealing:0,starter:true});
const pitching=playerGamePitchingSchema.parse({...common,id:"p",role:"reliever",starter:false,appearanceOrder:null,
  inningsPitchedOuts:2,battersFaced:3,hits:1,homeRuns:0,walks:null,strikeouts:1,runs:0,earnedRuns:0,pitches:12,catcherId:null,decision:"hold"});
const directory={players:[{playerId:"dual",displayName:"選手",teamId:"t"}]} as NpbPlayerDirectory;
async function batch(partial=false){
  return new PlayerPeriodBatchService({findSeasonBoundary:async()=>findNpbRegularSeason(date),
    findPeriodPlayerIds:async()=>({batters:["dual"],pitchers:["dual"]}),
    findBattingByPeriod:async()=>[{...batting, doubles:partial?null:0}],findPitchingByPeriod:async()=>[pitching]},
    {findPeriodCoverage:async(window)=>evaluatePeriodCoverage(window,[],[])},()=>new Date(at))
    .aggregate({asOfDate:date,period:"season"});
}
describe("season read model",()=>{
  it("reuses existing rates and preserves both roles, coverage and samples",async()=>{
    const result=await batch(),payload=buildNpbSeasonPayload(result,directory,at);
    const query={playerId:"dual",period:"season" as const,asOfDate:date};
    expect(result.batters[0]).toEqual(aggregateBatting(query,[batting],new Date(at),result.coverage,result.window));
    expect(result.pitchers[0]).toEqual(aggregatePitching(query,[pitching],new Date(at),result.coverage,result.window));
    expect(payload.players).toHaveLength(1);
    expect(payload.players[0]?.batting?.metrics.PA?.value).toBe(3);
    expect(payload.players[0]?.pitching?.metrics.outsRecorded?.value).toBe(2);
    expect(payload.coverage.status).toBe("unknown");
    expect(payload.readiness.rateQualifier).toBe("pending");
    expect(payload.rankings).toEqual({batting:[],pitching:[]});
    expect(JSON.stringify(payload)).not.toMatch(/WHIP|sourceRecordId|sourceUrl|private|token/);
    expect(buildNpbSeasonPayload(result,directory,at)).toEqual(payload);
  });
  it("retains nullable metric status and excludes incomplete rates from candidates",async()=>{
    const result=await batch(true),payload=buildNpbSeasonPayload(result,directory,at);
    expect(payload.players[0]?.batting?.metrics.OPS?.status).toBe(result.batters[0]?.metrics.OPS.status);
    expect(payload.players[0]?.batting?.metrics.OPS?.value).toBeNull();
    expect(seasonRankingReadModel(result).rates.candidates.OPS).toEqual([]);
    expect(seasonRankingReadModel(result).records.pitching.HLD?.[0]?.value).toBe(1);
  });
  it("rejects duplicate players, inconsistent dates and unknown schema fields",async()=>{
    const payload=buildNpbSeasonPayload(await batch(),directory,at);
    expect(()=>npbSeasonPayloadSchema.parse({...payload,players:[...payload.players,...payload.players]})).toThrow();
    expect(()=>npbSeasonPayloadSchema.parse({...payload,effectiveDate:"2026-09-25"})).toThrow();
    expect(()=>npbSeasonPayloadSchema.parse({...payload,token:"unsafe"})).toThrow();
  });
});
describe("season UI",()=>{
  it("shows both roles with saved-data wording and no final-season claims",async()=>{
    const result=await batch();
    const html=renderToStaticMarkup(<PlayerSeasonView state="ready" payload={{player:{id:"dual",name:"選手",teamId:"t",teamName:"球団"},
      asOfDate:date,period:"season",batting:result.batters[0]!,pitching:result.pitchers[0]!}} />);
    expect(html).toContain("2026シーズン成績");expect(html).toContain("保存済み成績");
    expect(html).toContain("9月26日終了時点");expect(html).toContain("K/9");expect(html).toContain("0.2");
    expect(html).not.toMatch(/WHIP|最終成績/);
  });
  it("isolates loading, error and no-Fact empty states without mock fallback",()=>{
    expect(renderToStaticMarkup(<PlayerSeasonView state="missing" payload={null} />)).toContain("保存済みシーズン成績はありません");
    expect(renderToStaticMarkup(<PlayerSeasonView state="error" payload={null} />)).toContain("シーズン成績を読み込めません");
    expect(renderToStaticMarkup(<PlayerSeasonView state="loading" payload={null} />)).toContain('aria-live="polite"');
  });
});
