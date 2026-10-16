import { describe, expect, it } from "vitest";
import { npbCompetitionScopeSchema, npbCompetitionAggregateSchema, sumNpbCompetitionRows, npbCompetitionCoverageSchema } from "../src/domain/npb-competition";
import { historicalBattingKeys, npbHistoricalRowSchema } from "../src/domain/npb-historical";
import { npbCs2026FinalRule } from "../src/domain/npb-cs-rules";
import { competitionFromSearch, seriesSchema } from "../src/domain/competition";
const id="00000000-0000-4000-8000-000000000001";
const scope={league:"NPB" as const,season:2026,competition:"regular" as const,stage:null};
const row={playerId:id,season:2026,teamId:"npb:team:tigers",role:"batting",metrics:Object.fromEntries(historicalBattingKeys.map(k=>[k,null])),scope};
const evidence={season:2026,leaderTeamId:"npb:team:tigers",challengerTeamId:"npb:team:giants",leader:{wins:80,losses:60},challenger:{wins:71,losses:69},standingsEvidenceUrl:"https://example.test/fictional-final-standings",observedAt:"2026-10-01T00:00:00Z"};
describe("NPB scoped aggregates; fictional fixture only",()=>{
  it.each([['preseason',null],['postseason','npb_cs_first'],['postseason','npb_cs_final'],['postseason','japan_series']])("never adds %s / %s to regular or changes identity",(competition,stage)=>{
    const other={...row,scope:{...scope,competition,stage}};
    expect(npbCompetitionAggregateSchema.parse(other).playerId).toBe(id);
    expect(()=>sumNpbCompetitionRows([row,other])).toThrow(/mix/);
    expect(sumNpbCompetitionRows([other]).metrics.H).toBeNull();
  });
  it("separates stages, seasons and legacy APIs",()=>{
    expect(npbHistoricalRowSchema.safeParse(row).success).toBe(false);
    expect(npbCompetitionScopeSchema.safeParse({...scope,competition:"preseason",stage:"japan_series"}).success).toBe(false);
    expect(npbCompetitionAggregateSchema.safeParse({...row,scope:{...scope,season:2025}}).success).toBe(false);
    expect(()=>sumNpbCompetitionRows([row,row])).toThrow(/Duplicate/);
    expect(competitionFromSearch(new URLSearchParams())).toBe("regular");
  });
  it("requires independent no-game and completeness evidence",()=>{
    const c={scope,state:"not_collected",savedGames:0,expectedGames:null,playerStats:"unavailable",evidence:[],reason:"No admitted source"};
    expect(npbCompetitionCoverageSchema.safeParse(c).success).toBe(true);
    for(const state of ["no_games","complete"])expect(npbCompetitionCoverageSchema.safeParse({...c,state}).success).toBe(false);
    expect(npbCompetitionCoverageSchema.safeParse({...c,state:"no_games",expectedGames:0,evidence:["https://example.test/fixture"]}).success).toBe(true);
  });
});
describe("2026 CS Final independently evidenced rules",()=>{
  it.each([[71,69,1,6,4],[70,70,2,7,5],[69,70,2,7,5],[70,69,1,6,4]])("evaluates exact gap/percentage boundaries %i-%i",(wins,losses,advantageWins,maxPlayedGames,winsRequired)=>{
    expect(npbCs2026FinalRule({...evidence,challenger:{wins,losses}})).toMatchObject({advantageWins,maxPlayedGames,winsRequired});
  });
  it("fails closed on missing standings, a different season or zero decisions",()=>{
    for(const e of [{...evidence,challenger:undefined},{...evidence,season:2025},{...evidence,challenger:{wins:0,losses:0}}])expect(()=>npbCs2026FinalRule(e)).toThrow();
  });
  it("accepts canonical NPB IDs and verified two-win rules without creating a bye Game",()=>{
    const e={...evidence,challenger:{wins:60,losses:80}};
    const s={id:"npb:series:"+id,league:"NPB",season:2026,competitionType:"postseason",round:"npb_cs_final",name:"Fictional test only",bestOf:7,winsRequired:5,npbFinalRuleEvidence:e,
      teams:[{teamId:e.leaderTeamId,playedWins:0,advantageWins:2,seriesTotal:2},{teamId:e.challengerTeamId,playedWins:0,advantageWins:0,seriesTotal:0}],games:[],status:"in_progress",winnerId:null,clinched:false,advancesToSeriesId:null,effectiveDate:"2026-10-01"};
    expect(seriesSchema.parse(s).games).toEqual([]);
    expect(seriesSchema.safeParse({...s,npbFinalRuleEvidence:undefined}).success).toBe(false);
    expect(seriesSchema.safeParse({...s,bestOf:6}).success).toBe(false);
    expect(seriesSchema.safeParse({...s,npbFinalRuleEvidence:{...e,season:2025}}).success).toBe(false);
    expect(seriesSchema.safeParse({...s,games:[{gameId:"npb:game:5956839637147e5631b2",date:"2026-10-01",gameNumber:1,homeTeamId:e.leaderTeamId,awayTeamId:e.challengerTeamId,homeRuns:null,awayRuns:null,status:"postponed",scheduledAt:null,winnerId:null}]}).success).toBe(true);
  });
});
