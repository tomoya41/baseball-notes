import { readFile,writeFile,mkdir,stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { chadwickBridge,readHistoricalCsv,importHistoricalSeason,isRegularRetrosheetGame,POSTSEASON_GAME_TYPES } from "../src/data/mlb-historical";
/** Isolated, unpublished source preflight. Does not expand any Production season schema. */
export async function preflightHistorical(cache:string,download=false) {
  const started=performance.now(),bridge=chadwickBridge(await readFile(join(cache,"chadwick-register.zip"))),seasons=[];
  let sourceRequests=0;
  for(const year of [2014,2015] as const){
    const path=join(cache,`${year}csvs.zip`);let zip:Buffer;
    try{zip=await readFile(path);}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT"||!download)throw e;const r=await fetch(`https://www.retrosheet.org/downloads/${year}/${year}csvs.zip`,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Official archive HTTP ${r.status}`,{cause:e});zip=Buffer.from(await r.arrayBuffer());await mkdir(cache,{recursive:true});await writeFile(path,zip);sourceRequests++;}
    const info=readHistoricalCsv(zip,year,"gameinfo"),plays=readHistoricalCsv(zip,year,"plays"),scopes=[];
    for(const competition of ["regular","postseason"] as const){
      // Source preflight alone still does not establish PA or publication readiness.
      const parsed=importHistoricalSeason(zip,year,bridge,competition);
      const selected=new Set(info.filter(g=>competition==="regular"?isRegularRetrosheetGame(g.gametype):POSTSEASON_GAME_TYPES.includes(g.gametype??"")).map(g=>g.gid));
      const scoped=plays.filter(p=>selected.has(p.gid)),pbpGames=new Set(scoped.map(p=>p.gid));
      scopes.push({competition,games:parsed.games.length,players:parsed.players.length,battingFacts:parsed.games.reduce((n,g)=>n+g.batting.length,0),pitchingFacts:parsed.games.reduce((n,g)=>n+g.pitching.length,0),sourcePaRows:scoped.filter(p=>p.pa==="1").length,pbpGames:pbpGames.size,missingPbpGames:[...selected].filter(g=>!pbpGames.has(g)).length,unresolvedIdentities:parsed.unresolvedRetrosheetIds.length,boxscoreValidationIssues:parsed.validationIssueCount,unknownPitcherRoles:parsed.games.flatMap(g=>g.pitching).filter(p=>p.role==="unknown").length,teams:new Set(parsed.games.flatMap(g=>[g.homeTeamId,g.awayTeamId])).size,rounds:[...new Set(parsed.games.map(g=>g.postseasonRound).filter(Boolean))],paReconstruction:"not_run",publicReady:false});
    }
    seasons.push({year,zipBytes:(await stat(path)).size,zipSha256:createHash("sha256").update(zip).digest("hex"),scopes});
  }
  return {result:"PREFLIGHT_ONLY",seasons,sourceRequests,canonicalWrites:0,publicChanges:0,elapsedMs:Math.round(performance.now()-started),nextUnit:2015,remainingGates:["Full canonical PA reconstruction and independent Game Fact validation","Independent aggregates and old-release preservation","DB/backup capacity and complete CI runtime benchmark","Production schema/manifest admission only after all quality gates"]};
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("preflight-historical-2014-2015.ts")){const r=await preflightHistorical(process.argv[2]??".data",process.argv.includes("--download"));await writeFile(process.argv[3]??".data/historical-2014-2015-preflight.json",JSON.stringify(r,null,2));console.log(JSON.stringify(r));}
