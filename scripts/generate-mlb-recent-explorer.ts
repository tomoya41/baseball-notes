import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { HistoricalGame } from "../src/data/mlb-historical";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { battingDailyKeys, pitchingDailyKeys, recentIndexSchema, recentMonthSchema, } from "../src/domain/mlb-recent-explorer";


export function buildMlbRecentMonths(input: {game:HistoricalGame;hash:string}[], competitionType:"regular"|"postseason", season:number) {
  const games=[...input].sort((a,b)=>a.game.id.localeCompare(b.game.id));
  const sourceFingerprint=createHash("sha256").update(games.map(g=>`${g.game.id}:${g.hash}`).join("\n")).digest("hex");
  const months=new Map<string,{batting:Map<string,(number|null)[]>;pitching:Map<string,(number|null)[]>}>();
  const ids=[...new Set(games.flatMap(g=>[...g.game.batting,...g.game.pitching].map(p=>p.playerId)))].sort(),teams=[...new Set(games.flatMap(g=>[g.game.homeTeamId,g.game.awayTeamId]))].sort();
  const idIndex=new Map(ids.map((id,i)=>[id,i])),teamIndex=new Map(teams.map((id,i)=>[id,i]));
  for(const {game} of games) {
    const month=game.date.slice(0,7),data=months.get(month)??{batting:new Map(),pitching:new Map()};months.set(month,data);
    for(const role of ["batting","pitching"] as const) {
      const seen=new Set<string>();
      for(const fact of game[role]) {
        const key=`${game.date}:${fact.playerId}:${fact.teamId}`;
        if(seen.has(key))throw Error("Duplicate source player Game Fact");seen.add(key);
        if(fact.teamId!==game.homeTeamId&&fact.teamId!==game.awayTeamId)throw Error("Fact team mismatch");
        const fields=role==="batting"?["pa","ab","runs","hits","doubles","triples","homeRuns","rbi","bb","hbp","sh","sf","so","sb","cs"]:["role","outsRecorded","bf","hits","homeRuns","bb","hbp","so","runs","er","win","loss","save"];
        const record=fact as unknown as Record<string,unknown>;
        const values=fields.map(f=>{const v=record[f];return f==="role"?v==="unknown"?null:v==="starter"?1:0:typeof v==="boolean"?Number(v):v as number|null;});
        const next=[Number(game.date.slice(8)),idIndex.get(fact.playerId)!,teamIndex.get(fact.teamId)!,1,...values],old=data[role].get(key);
        if(old) for(let i=3;i<next.length;i++) next[i]=next[i]===null||old[i]===null?null:next[i]!+old[i]!;
        data[role].set(key,next);
      }
    }
  }
  return [...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,data])=>recentMonthSchema.parse({schemaVersion:1,league:"MLB",competitionType,season,sourceFingerprint,month,players:ids,teams,batting:[...data.batting.values()],pitching:[...data.pitching.values()]}));
}

export async function generateMlbRecentExplorer(root:string, baselineRoot?:string) {
  const started=performance.now();let files=0,bytes=0,largest=0,rows=0;
  const compress = async (path: string, payload: unknown) => {
    if (baselineRoot) {
      try {
        const previous = await readFile(join(baselineRoot, path));
        if (!isDeepStrictEqual(JSON.parse(gunzipSync(previous).toString()), payload)) throw Error(`Existing Recent content changed: ${path}`);
        return previous;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    return gzipSync(JSON.stringify(payload));
  };
  for (const competitionType of ["regular","postseason"] as const) {
    const base=competitionType==="regular"?root:join(root,"postseason"),prefix=competitionType==="regular"?"":"postseason/";
    if (competitionType === "postseason") {
      try { if (!(await stat(base)).isDirectory()) throw Error("Invalid Postseason subtree"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    }
    const read=async<T>(path:string):Promise<T>=>{const value:unknown=JSON.parse(gunzipSync(await readFile(join(base,`${path}.gz`))).toString());if(!validStaticPayload(prefix+path,value))throw Error(`Invalid historical source ${prefix+path}`);return value as T;};
    const manifest=await read<{seasons:{season:number;firstDate:string;lastDate:string;games:number;coverage:"complete"|"partial"|"unavailable"}[]}>("manifest.json");
    const byYear=new Map<number,{game:HistoricalGame;hash:string}[]>();
    for(const name of (await readdir(join(base,"games"))).sort()) {
      if(!name.endsWith(".json.gz"))continue;
      const raw=await readFile(join(base,"games",name)),path=`games/${name.slice(0,-3)}`,value:unknown=JSON.parse(gunzipSync(raw).toString());
      if(!validStaticPayload(prefix+path,value))throw Error(`Invalid source ${path}`);
      const game=(value as {game:HistoricalGame}).game;
      const list=byYear.get(game.season)??[];list.push({game,hash:createHash("sha256").update(raw).digest("hex")});byYear.set(game.season,list);
    }
    for(const descriptor of manifest.seasons) {
      const games=byYear.get(descriptor.season)??[],season=await read<{gameCount:number;firstDate:string;lastDate:string}>(`seasons/${descriptor.season}.json`);
      if(games.length!==descriptor.games || games.length!==season.gameCount || season.firstDate!==descriptor.firstDate || season.lastDate!==descriptor.lastDate || games.some(g=>g.game.date<descriptor.firstDate||g.game.date>descriptor.lastDate) || new Set(games.map(g=>g.game.id)).size!==games.length)throw Error("Source coverage mismatch");
      const monthPayloads=buildMlbRecentMonths(games,competitionType,descriptor.season),sourceFingerprint=monthPayloads[0]!.sourceFingerprint;
      const dir=join(base,"exploration","recent",String(descriptor.season));await mkdir(dir,{recursive:true});
      const monthDescriptors=[];
      for(const payload of monthPayloads) {
        const month=payload.month;
        recentMonthSchema.parse(payload);
        if(payload.batting.some(r=>r.length!==3+battingDailyKeys.length)||payload.pitching.some(r=>r.length!==3+pitchingDailyKeys.length))throw Error("Daily columns mismatch");
        const compressed=await compress(`${prefix}exploration/recent/${descriptor.season}/${month}.json.gz`,payload);await writeFile(join(dir,`${month}.json.gz`),compressed);
        files++;bytes+=compressed.length;largest=Math.max(largest,compressed.length);rows+=payload.batting.length+payload.pitching.length;
        monthDescriptors.push({month,compressedBytes:compressed.length,rows:payload.batting.length+payload.pitching.length});
      }
      const index=recentIndexSchema.parse({schemaVersion:1,league:"MLB",competitionType,season:descriptor.season,sourceFingerprint,firstDate:descriptor.firstDate,lastDate:descriptor.lastDate,coverage:descriptor.coverage,gameCount:games.length,months:monthDescriptors});
      const compressed=await compress(`${prefix}exploration/recent/${descriptor.season}/index.json.gz`,index);await writeFile(join(dir,"index.json.gz"),compressed);files++;bytes+=compressed.length;
    }
  }
  const report={files,compressedBytes:bytes,largestPayload:largest,dailyAggregateRows:rows,generationMs:Math.round(performance.now()-started),canonicalWrites:0,sourceRequests:0};console.log(JSON.stringify(report));return report;
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("generate-mlb-recent-explorer.ts")) {
  const args=process.argv.slice(2),baseline=args.includes("--baseline")?args[args.indexOf("--baseline")+1]:undefined;
  await generateMlbRecentExplorer(args[0]??"dist/data/mlb/historical",baseline);
}
