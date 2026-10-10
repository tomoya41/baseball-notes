import { readFile,readdir,writeFile,stat } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { battingAggregate,pitchingAggregate,dateWindow,type DatedBatter,type DatedPitcher } from "../src/domain/mlb-historical-aggregate";
import { foldRecent,recentMonths,recentIndexSchema,recentMonthSchema,type RecentIndex,type RecentMonth } from "../src/domain/mlb-recent-explorer";
import { mlbProductMetrics } from "../src/domain/mlb-product-metrics";
import type { HistoricalGame } from "../src/data/mlb-historical";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import type { ExplorerValues } from "../src/domain/data-explorer";

export async function verifyMlbRecentExplorer(root:string) {
  const started=performance.now();let comparisons=0,windows=0,totalGames=0,maxFoldMs=0,maxRows=0;const scopes=[];
  for(const competition of ["regular","postseason"] as const) {
    const base=competition==="regular"?root:join(root,"postseason"),prefix=competition==="regular"?"":"postseason/";
    if (competition === "postseason") {
      try { if (!(await stat(base)).isDirectory()) throw Error("Invalid Postseason subtree"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    }
    const read=async<T>(path:string):Promise<T>=>{const p:unknown=JSON.parse(gunzipSync(await readFile(join(base,`${path}.gz`))).toString());if(!validStaticPayload(prefix+path,p))throw Error(`Invalid public contract ${path}`);return p as T;};
    const manifest=await read<{seasons:{season:number;firstDate:string;lastDate:string}[]}>("manifest.json"),directory=await read<{players:{id:string;name:string}[]}>("players/index.json");
    const names=new Map(directory.players.map(p=>[p.id,p.name]));
    const games:HistoricalGame[]=[];for(const f of (await readdir(join(base,"games"))).sort()){if(f.endsWith(".json.gz"))games.push((await read<{game:HistoricalGame}>(`games/${f.slice(0,-3)}`)).game);}totalGames+=games.length;
    for(const s of manifest.seasons) {
      const yearGames=games.filter(g=>g.season===s.season),index=recentIndexSchema.parse(await read<RecentIndex>(`exploration/recent/${s.season}/index.json`));
      const allMonths=await Promise.all(index.months.map(async m=>recentMonthSchema.parse(await read<RecentMonth>(`exploration/recent/${s.season}/${m.month}.json`))));
      const grouped=new Map<string,{b:DatedBatter[];p:DatedPitcher[]}>();
      for(const game of yearGames)for(const role of ["batting","pitching"] as const)for(const fact of game[role]){
        const value=grouped.get(fact.playerId)??{b:[],p:[]},home=fact.teamId===game.homeTeamId;
        const r={...fact,gameId:game.id,date:game.date,season:game.season,home,opponentTeamId:home?game.awayTeamId:game.homeTeamId};
        if(role==="batting")value.b.push(r as DatedBatter);else value.p.push(r as DatedPitcher);grouped.set(fact.playerId,value);
      }
      const mid=new Date((Date.parse(s.firstDate)+Date.parse(s.lastDate))/2).toISOString().slice(0,10);
      const dates=[s.firstDate,mid,s.lastDate],teams=["",yearGames[0]!.homeTeamId];let seasonWindows=0;
      for(const date of dates)for(const days of [7,14,30] as const)for(const team of teams){
        const required=recentMonths(index,date,days),t=performance.now(),rows=foldRecent(index,allMonths.filter(m=>required.includes(m.month)),names,date,days,team);maxFoldMs=Math.max(maxFoldMs,performance.now()-t);maxRows=Math.max(maxRows,rows.length);windows++;seasonWindows++;
        const {from,to}=dateWindow(date,days),actual=new Map(rows.map(r=>[r.playerId,r]));
        for(const [id, facts] of grouped){
          const b=facts.b.filter(r=>r.date>=from&&r.date<=to&&(!team||r.teamId===team)),p=facts.p.filter(r=>r.date>=from&&r.date<=to&&(!team||r.teamId===team));
          if(!b.length&&!p.length){if(actual.has(id))throw Error("Unexpected Recent player");continue;}
          const expected={batting:b.length?mlbProductMetrics(battingAggregate(id,b,from,to).metrics,"batting"):null,pitching:p.length?mlbProductMetrics(pitchingAggregate(id,p,from,to).metrics,"pitching"):null};
          for(const role of ["batting","pitching"] as const){const a=actual.get(id)?.[role],e=expected[role];if(!e){if(a)throw Error("Unexpected role");continue;}if(!a)throw Error("Missing role");
            for(const key of Object.keys(a)) {if(!e[key])continue;const av=a[key]!.value,ev=(e as ExplorerValues)[key]!.value;comparisons++;if(av===null?ev!==null:ev===null||Math.abs(av-ev)>1e-10)throw Error(`Recent mismatch ${competition}/${s.season}/${date}/${days}/${id}/${role}/${key}: ${av} != ${ev}`);}
          }
        }
      }
      scopes.push({competition,season:s.season,games:yearGames.length,windows:seasonWindows,sourceFingerprint:index.sourceFingerprint});
    }
  }
  const report={result:"PASS",scopes,totalGames,windows,metricComparisons:comparisons,mismatches:0,maxFoldMs:Math.round(maxFoldMs),maxWindowPlayers:maxRows,elapsedMs:Math.round(performance.now()-started),canonicalWrites:0,queries:0};
  return report;
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("verify-mlb-recent-explorer.ts")) {
  const report=await verifyMlbRecentExplorer(process.argv[2]??"dist/data/mlb/historical");
  await writeFile(process.argv[3]??".data/track2-recent-verification.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
