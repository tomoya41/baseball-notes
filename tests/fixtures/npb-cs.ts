import {npbCsDatasetSchema} from "../../src/domain/npb-cs-observations";
import {historicalBattingKeys,historicalPitchingKeys,sumHistoricalRows} from "../../src/domain/npb-historical";
import {npbCompetitionAggregateSchema} from "../../src/domain/npb-competition";
export const csGameId="npb:game:"+"a".repeat(20);
export function csGameFixture(){
 const scope={league:"NPB",season:2026,temporalScope:"saved_current",competition:"postseason",stage:"npb_cs_final"};
 const players=[1,2].map(i=>({playerId:`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`,name:`架空のとても長い選手名${i}`,article:`架空選手${i}`,wikidataId:`Q${100+i}`,npbId:String(10000000+i),revision:100+i,revisionAt:"2026-10-15T00:00:00Z",contentSha256:"b".repeat(64)}));
 const games=[csGameId,"npb:game:"+"b".repeat(20)].map((id,i)=>({id,date:`2026-10-${16+i}`,stage:"npb_cs_final",homeTeamId:"npb:team:tigers",awayTeamId:"npb:team:baystars",homeScore:3,awayScore:2,homeHits:null,awayHits:5,sourcePageId:5302364,status:"final"}));
 const observations=games.flatMap((game,i)=>players.map((player,p)=>({gameId:game.id,aggregate:{playerId:player.playerId,season:2026,teamId:p===0?"npb:team:tigers":"npb:team:baystars",role:p===0?"batting":"pitching",scope,metrics:p===0?{...Object.fromEntries(historicalBattingKeys.map(k=>[k,null])),G:1,AB:4,H:2,HR:i,RBI:1}:{...Object.fromEntries(historicalPitchingKeys.map(k=>[k,null])),G:1,outsRecorded:1,SO:i+2,R:0,ER:0}}})));
 const rows=players.map(player=>{const group=observations.filter(o=>o.aggregate.playerId===player.playerId);return {aggregate:{...group[0]!.aggregate,metrics:sumHistoricalRows(group.map(g=>npbCompetitionAggregateSchema.parse(g.aggregate))).metrics},gameIds:group.map(g=>g.gameId)};});
 return npbCsDatasetSchema.parse({schemaVersion:1,league:"NPB",season:2026,temporalScope:"saved_current",competition:"postseason",provider:"Wikipedia",license:"CC-BY-SA-4.0",coverage:"partial",granularity:"collected_game_aggregate",observedAt:"2026-10-18T00:00:00Z",inputSha256:"a".repeat(64),transformation:"Synthetic fixture only",sources:[{pageId:5302364,title:"架空CS記事",revision:200,revisionAt:"2026-10-17T00:00:00Z",contentSha256:"b".repeat(64)}],players,games,rows,observations});
}
