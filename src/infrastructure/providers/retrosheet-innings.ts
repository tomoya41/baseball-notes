import { inningScoreSchema, type InningCell, type InningScore } from "../../domain/inning-score";
import { historicalId,historicalTeamId,isRegularRetrosheetGame,POSTSEASON_GAME_TYPES } from "../../data/mlb-historical";
import { evidenceDigest,type CsvRecord } from "./lahman-honors";
const number=(s:string|undefined)=>s!==undefined&&/^\d+$/.test(s)?Number(s):null;
/** Dense complete source rows only. Blank cells are never runs. */
export function parseRetrosheetInnings(info:readonly CsvRecord[],teamRows:readonly CsvRecord[],year:number,sourceId:string,admittedIds:ReadonlySet<string>){
 const byGame=new Map<string,CsvRecord[]>();for(const r of teamRows){const a=byGame.get(r.gid!)??[];a.push(r);byGame.set(r.gid!,a);}
 const games:InningScore[]=[],held:{gameId:string;reason:string}[]=[];
 for(const g of info){const id=historicalId("game",g.gid??"");if(!admittedIds.has(id))continue;
  try{const competition=isRegularRetrosheetGame(g.gametype)?"regular":POSTSEASON_GAME_TYPES.includes(g.gametype??"")?"postseason":null;if(!competition||g.line!=="y"||g.forfeit)throw Error("unavailable_or_forfeit_linescore");
   const rows=byGame.get(g.gid!)??[],a=rows.filter(r=>r.team===g.visteam&&r.stattype==="value"),h=rows.filter(r=>r.team===g.hometeam&&r.stattype==="value");if(a.length!==1||h.length!==1)throw Error("ambiguous_team_rows");
   const read=(r:CsvRecord,total:string|undefined)=>{let last=0;for(let i=1;i<=28;i++)if(r[`inn${i}`]!==undefined&&r[`inn${i}`]!=="")last=i;if(!last)throw Error("missing_innings");const innings:InningCell[]=Array.from({length:last},(_,i)=>{const n=number(r[`inn${i+1}`]);if(n===null)throw Error("missing_internal_inning");return n;});const runs=number(total);if(runs===null||number(r.b_r)!==runs)throw Error("source_score_mismatch");return{runs,hits:number(r.b_h),errors:number(r.d_e),innings};};
   const away=read(a[0]!,g.vruns),home=read(h[0]!,g.hruns);const scheduled=g.innings===""?9:number(g.innings),n=Math.max(away.innings.length,home.innings.length);
   // These markers follow a complete source linescore plus the final score;
   // no marker is inferred for unknown/forfeit or home-batted-first games.
   if(["","false","n"].includes(g.htbf??"unknown")){
    if(home.innings.length+1===away.innings.length&&home.runs>away.runs)home.innings.push("X");
    // gameinfo.innings is scheduled length, not the number actually played.
    else if(scheduled!==null&&n>=scheduled&&home.innings.length===away.innings.length&&home.runs>away.runs){const last=home.innings.at(-1);if(typeof last==="number"&&last>0&&home.runs-last<=away.runs)home.innings[home.innings.length-1]=`${last}x`;}
   }
   games.push(inningScoreSchema.parse({gameId:id,league:"MLB",season:year,date:`${g.date!.slice(0,4)}-${g.date!.slice(4,6)}-${g.date!.slice(6,8)}`,competition,away:{id:historicalTeamId(g.visteam!),...away},home:{id:historicalTeamId(g.hometeam!),...home},sourceId,evidenceSha256:evidenceDigest(JSON.stringify([g,a[0],h[0]]))}));
  }catch(e){held.push({gameId:id,reason:(e as Error).message});}
 }
 return{games,held};
}
