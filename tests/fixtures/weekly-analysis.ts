import { historicalId,type HistoricalGame } from "../../src/data/mlb-historical";
import { buildFormMonths } from "../../scripts/generate-historical-form";
import type { FormIndex } from "../../src/domain/historical-form";

export function weeklyFixture(competitionType:"regular"|"postseason"="regular") {
  const home=historicalId("team","weekly-home"),away=historicalId("team","weekly-away"),
    ids=["batter","starter","relief","tiny"].map(s=>historicalId("player",`weekly-${s}`));
  const games=Array.from({length:30},(_,i)=>{
    const current=i>=21,date=`2025-09-${String(i+1).padStart(2,"0")}`;
    const batting=[{playerId:ids[0]!,teamId:home,battingOrder:1,appearanceOrder:1,starter:true,pa:4,ab:4,runs:1,hits:current?3:1,doubles:0,triples:0,homeRuns:1,rbi:2,bb:0,hbp:0,sh:0,sf:0,so:1,sb:0,cs:0},
      {playerId:ids[3]!,teamId:away,battingOrder:1,appearanceOrder:1,starter:true,pa:1,ab:1,runs:0,hits:1,doubles:0,triples:0,homeRuns:0,rbi:0,bb:0,hbp:0,sh:0,sf:0,so:0,sb:0,cs:0}];
    const pitching=[{playerId:ids[1]!,teamId:home,role:"starter" as const,appearanceOrder:1,outsRecorded:18,bf:20,hits:2,homeRuns:0,bb:0,hbp:0,so:7,runs:0,er:current?0:3,win:true,loss:false,save:false,hold:null,pitchCount:null},
      {playerId:ids[2]!,teamId:home,role:"reliever" as const,appearanceOrder:2,outsRecorded:6,bf:7,hits:1,homeRuns:0,bb:0,hbp:0,so:3,runs:0,er:current?0:1,win:false,loss:false,save:true,hold:null,pitchCount:null}];
    return {id:historicalId("game",`weekly-${competitionType}-${date}`),season:2025,date,competitionType,homeTeamId:home,awayTeamId:away,homeRuns:4,awayRuns:3,innings:9,number:1,batting,pitching} as HistoricalGame;
  });
  const months=buildFormMonths(games.map(game=>({game,hash:"a".repeat(64)})),competitionType,2025),month=months[0]!;
  const index:FormIndex={schemaVersion:1,league:"MLB",competitionType,season:2025,sourceFingerprint:month.sourceFingerprint,roleSourceHash:"b".repeat(64),firstDate:"2025-09-01",lastDate:"2025-09-30",coverage:"complete",gameCount:30,
    roles:ids.map((playerId,i)=>({playerId,positions:[i===0||i===3?"SS":"P"],positionDates:[{position:i===0||i===3?"SS":"P",date:"2025-09-01"}],battingRole:i===0||i===3?"fielder":"pitcher",twoWayEvidence:false,twoWayEvidenceDate:null})),
    months:[{month:"2025-09",compressedBytes:100,rows:month.batting.length+month.starters.length+month.relievers.length}]};
  const manifest={seasons:[{season:2025,firstDate:index.firstDate,lastDate:index.lastDate,games:30,coverage:"complete"}],teams:[{id:home,name:"架空ホーム"},{id:away,name:"架空ビジター"}]};
  const prefix=competitionType==="postseason"?"postseason/":"",payloads=new Map<string,unknown>([
    [`${prefix}exploration/form/2025/index.json`,index],[`${prefix}exploration/form/2025/2025-09.json`,month],
    [`${prefix}chronology/2025.json`,{schemaVersion:1,league:"MLB",season:2025,competitionType,games:games.map(g=>({gameId:g.id,date:g.date,number:1}))}],
    [`${prefix}players/index.json`,{schemaVersion:1,league:"MLB",competitionType,players:ids.map((id,i)=>({id,name:`架空選手${i}`,seasons:[2025],positions:[i===0||i===3?"SS":"P"],teamIds:[home,away]}))}],
  ]);
  for(const g of games)payloads.set(`${prefix}schedule/2025/${g.date}.json`,{schemaVersion:1,league:"MLB",competitionType,season:2025,date:g.date,games:[{id:g.id,homeTeamId:home,awayTeamId:away,homeRuns:g.homeRuns,awayRuns:g.awayRuns,status:"final",complete:true,number:1}]});
  const read=async<T>(path:string):Promise<T>=>{if(!payloads.has(path))throw Error(`Unknown fixture path ${path}`);return payloads.get(path) as T;};
  return {games,index,month,manifest,payloads,read,home,away,ids};
}
