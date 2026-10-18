import {expect,it} from "vitest";
import {verifyCsExpansion} from "../scripts/verify-npb-cs-expansion";
import {npbCsDatasetSchema} from "../src/domain/npb-cs-observations";
import {historicalPitchingKeys} from "../src/domain/npb-historical";
import {sumHistoricalRows} from "../src/domain/npb-historical";
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
it("validates public per-game observations independently of stage totals while retaining legacy snapshots",()=>{
 const data=fixture(),o={aggregate:data.rows[0]!.aggregate,gameId:data.games[0]!.id};
 expect(npbCsDatasetSchema.safeParse(data).success).toBe(true);
 expect(npbCsDatasetSchema.safeParse({...data,observations:[o]}).success).toBe(true);
 expect(npbCsDatasetSchema.safeParse({...data,observations:[o,o]}).success).toBe(false);
 expect(npbCsDatasetSchema.safeParse({...data,observations:[]}).success).toBe(false);
 const bad=structuredClone(o);bad.aggregate.metrics.outsRecorded=2;
 expect(npbCsDatasetSchema.safeParse({...data,observations:[bad]}).success).toBe(false);
 bad.aggregate.metrics.outsRecorded=1;bad.aggregate.scope.competition="regular";bad.aggregate.scope.stage=null;
 expect(npbCsDatasetSchema.safeParse({...data,observations:[bad]}).success).toBe(false);
});

it("extends a stage total only with complete per-game replay and unchanged prior observations",()=>{
 const before=fixture(),after=structuredClone(before),old={aggregate:before.rows[0]!.aggregate,gameId:before.games[0]!.id};
 after.games.push({...after.games[0]!,id:"npb:game:"+"b".repeat(20),date:"2026-10-17"});
 const added={aggregate:structuredClone(old.aggregate),gameId:after.games[1]!.id};added.aggregate.metrics.outsRecorded=2;
 after.rows[0]!.gameIds.push(added.gameId);after.rows[0]!.aggregate.metrics=sumHistoricalRows([old.aggregate,added.aggregate]).metrics;
 expect(verifyCsExpansion(before,npbCsDatasetSchema.parse(after),{before:[old],after:[old,added]})).toMatchObject({unchangedRows:0,extendedRows:1,verifiedPriorObservations:1,addedObservations:1});
 expect(()=>verifyCsExpansion(before,after)).toThrow("aggregate");
 expect(()=>verifyCsExpansion(before,after,{before:[old],after:[added]})).toThrow("Observation");
 expect(()=>verifyCsExpansion(before,after,{before:[old],after:[old,old,added]})).toThrow("observation");
 const altered=structuredClone(old);altered.aggregate.metrics.outsRecorded=0;
 const fake=structuredClone(after);fake.rows[0]!.aggregate.metrics=sumHistoricalRows([altered.aggregate,added.aggregate]).metrics;
 expect(()=>verifyCsExpansion(before,fake,{before:[old],after:[altered,added]})).toThrow("per-game");
 const badTotal=structuredClone(after);badTotal.rows[0]!.aggregate.metrics.outsRecorded=9;
 expect(()=>verifyCsExpansion(before,badTotal,{before:[old],after:[old,added]})).toThrow("totals");
 const otherRole=structuredClone(added);otherRole.aggregate.scope.stage="npb_cs_first";
 expect(()=>verifyCsExpansion(before,after,{before:[old],after:[old,otherRole]})).toThrow("observation");
});

