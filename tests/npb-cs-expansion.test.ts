import {expect,it} from "vitest";
import {verifyCsExpansion} from "../scripts/verify-npb-cs-expansion";
import {npbCsDatasetSchema} from "../src/domain/npb-cs-observations";
import {historicalPitchingKeys} from "../src/domain/npb-historical";
const id="00000000-0000-4000-8000-000000000001";

function fixture(){
 const p={playerId:id,name:"架空選手",wikidataId:"Q100",npbId:"10000000",article:"架空選手",revision:100,revisionAt:"2026-01-01T00:00:00Z",contentSha256:"b".repeat(64)};
 return npbCsDatasetSchema.parse({schemaVersion:1,league:"NPB",season:2026,temporalScope:"saved_current",competition:"postseason",provider:"Wikipedia",license:"CC-BY-SA-4.0",coverage:"partial",granularity:"collected_game_aggregate",observedAt:"2026-10-17T00:00:00Z",inputSha256:"a".repeat(64),transformation:"Synthetic fixture only",sources:[{pageId:1,title:"架空CS",revision:2,revisionAt:"2026-10-16T00:00:00Z",contentSha256:"b".repeat(64)}],players:[p],games:[{id:"npb:game:"+"a".repeat(20),date:"2026-10-16",stage:"npb_cs_final",homeTeamId:"npb:team:tigers",awayTeamId:"npb:team:hawks",homeScore:1,awayScore:0,homeHits:null,awayHits:null,sourcePageId:1,status:"final"}],rows:[{aggregate:{playerId:id,season:2026,teamId:"npb:team:tigers",role:"pitching",metrics:{...Object.fromEntries(historicalPitchingKeys.map(k=>[k,null])),G:1,outsRecorded:1},scope:{league:"NPB",season:2026,temporalScope:"saved_current",competition:"postseason",stage:"npb_cs_final"}},gameIds:["npb:game:"+"a".repeat(20)]}]});
}
it("admits only additive CS snapshots and independently rejects changed values, missing rows and rekeyed identity",()=>{
 const before=fixture(),after=structuredClone(before);after.games.push({...after.games[0]!,id:"npb:game:"+"b".repeat(20)});
 expect(verifyCsExpansion(before,after)).toMatchObject({gamesBefore:1,gamesAfter:2,unchangedRows:1,coverage:"partial",canonicalWrites:0});
 const score=structuredClone(after);score.games[0]!.homeScore=2;expect(()=>verifyCsExpansion(before,score)).toThrow(/Game/);
 const outs=structuredClone(after);outs.rows[0]!.aggregate.metrics.outsRecorded=3;expect(()=>verifyCsExpansion(before,outs)).toThrow(/aggregate/);
 expect(()=>verifyCsExpansion(before,{...after,rows:[]})).toThrow(/aggregate/);
 const id=structuredClone(after);id.players[0]!.npbId="99999999";expect(()=>verifyCsExpansion(before,id)).toThrow(/identity/);
});

