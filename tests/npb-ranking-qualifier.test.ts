import { describe,expect,it } from "vitest";
import { qualifyNpbSeason } from "../src/domain/npb-ranking-qualifier";
const sample=(value:number|null,status:"complete"|"partial"|"unavailable"="complete")=>({value,status,observedFacts:1,factCount:1});
const base={role:"batting" as const,coverageComplete:true,teamGames:135,playerTeamIds:["t"],displayTeamId:"t",sample:sample(419)};
describe("verified NPB actual-game qualification",()=>{
  it("rounds 3.1 PA per game without floating-point edge cases",()=>{
    expect(qualifyNpbSeason(base)).toEqual({status:"qualified",threshold:419,reason:null});
    expect(qualifyNpbSeason({...base,sample:sample(418)}).status).toBe("unqualified");
    expect(qualifyNpbSeason({...base,teamGames:134,sample:sample(415)}).threshold).toBe(415);
    expect(qualifyNpbSeason({...base,teamGames:143}).threshold).toBe(443);
  });
  it("uses outs, never decimal innings, for pitching qualification",()=>{
    expect(qualifyNpbSeason({...base,role:"pitching",sample:sample(405)})).toMatchObject({status:"qualified",threshold:405});
    expect(qualifyNpbSeason({...base,role:"pitching",sample:sample(404)}).status).toBe("unqualified");
  });
  it("fails closed on incomplete coverage, missing metrics, missing team games and transfers",()=>{
    expect(qualifyNpbSeason({...base,coverageComplete:false}).status).toBe("unknown");
    expect(qualifyNpbSeason({...base,teamGames:null}).status).toBe("unknown");
    expect(qualifyNpbSeason({...base,sample:sample(null,"unavailable")}).status).toBe("unknown");
    expect(qualifyNpbSeason({...base,sample:sample(600,"partial")}).status).toBe("unknown");
    expect(qualifyNpbSeason({...base,playerTeamIds:["t","other"]}).status).toBe("unknown");
    expect(qualifyNpbSeason({...base,displayTeamId:"other"}).status).toBe("unknown");
  });
});
