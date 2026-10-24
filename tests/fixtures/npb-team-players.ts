import { buildNpbCatalog } from "../../src/application/npb-product-payload";
import { npbSeasonPayloadSchema, seasonBattingKeys, seasonPitchingKeys } from "../../src/application/npb-season-payload";
import { npbTeams } from "../../src/data/npb-nf3";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const teamId = "npb:team:tigers", date = "2026-10-12", at = "2026-10-13T00:00:00Z";
export const rosterCatalog = buildNpbCatalog({schemaVersion:2,league:"NPB",effectiveDate:date,generatedAt:at,
  teams:npbTeams.map(t=>({id:t.id,name:t.name,shortName:t.short})),players:[1,2,3].map(n=>({playerId:id(n),displayName:`架空選手${n}`,teamId,
    position:null,playerType:null,birthDate:null,birthPlace:null,nationality:null,bats:null,throws:null,battingAvailable:true,pitchingAvailable:true,recentAvailable:true}))},
  {observedAt:at,effectiveDate:date,players:[]});
rosterCatalog.players.forEach((p,i)=>Object.assign(p.membership,{uniformNumber:["0","12","99"][i],uniformNumberEffectiveDate:i===2?"2025-01-01":date,uniformNumberObservedAt:at}));
const metrics = (keys:readonly string[], values:Record<string,number>)=>Object.fromEntries(keys.map(k=>[k,{value:values[k]??null,status:values[k]===undefined?"unavailable":"partial",observedFacts:values[k]===undefined?0:1,factCount:1}]));
export const rosterSeason = npbSeasonPayloadSchema.parse({schemaVersion:1,league:"NPB",season:2026,effectiveDate:date,generatedAt:at,
  period:{from:"2026-03-27",to:"2026-10-08"},coverage:{status:"partial",summary:{dates:1,complete:0,noGames:0,partial:1,unknown:0,failed:0}},
  readiness:{status:"not_ready",reasons:["coverage"],counting:"not_ready",rateQualifier:"pending"},rankings:{batting:[],pitching:[]},
  players:[1,2,3].map((n,i)=>({playerId:id(n),displayName:`架空選手${n}`,teamId,
    batting:{factCount:1,metrics:metrics(seasonBattingKeys,{G:[0,10,20][i]!})},
    pitching:{factCount:1,metrics:metrics(seasonPitchingKeys,{G:n,outsRecorded:[0,31,32][i]!})}}))});

