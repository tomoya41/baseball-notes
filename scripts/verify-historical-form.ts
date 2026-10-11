import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { HistoricalGame } from "../src/data/mlb-historical";
import { battingAggregate, pitchingAggregate, type DatedBatter, type DatedPitcher } from "../src/domain/mlb-historical-aggregate";
import { evaluateHistoricalForm, formIndexSchema, formMonthSchema, formMonths, FORM_POLICY, isMonthlyForm, isFormComparison, type FormCategory, type FormMode } from "../src/domain/historical-form";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { mlbProductMetrics } from "../src/domain/mlb-product-metrics";
import type { ExplorerValues } from "../src/domain/data-explorer";

type GroupedFacts = ReadonlyMap<string,{b:DatedBatter[];p:DatedPitcher[]}>;
/** Admission is derived from source Game Facts, including players absent from a shard. */
export function verifyFormPopulation(grouped:GroupedFacts, context:{category:FormCategory;mode:FormMode;days:7|14|30;competition:"regular"|"postseason";coverage:string;from:string;to:string;previousFrom:string;previousTo?:string}, actual:readonly {playerId:string}[]) {
  const expected=new Map<string,ExplorerValues>();
  const {category,mode,days,from,to}=context,policy=FORM_POLICY[category];
  const unknown=category!=="batting"&&[...grouped.values()].some(rows=>rows.p.some(p=>p.role==="unknown"&&(p.date>=from&&p.date<=to||isFormComparison(mode)&&p.date>=context.previousFrom&&p.date<=(context.previousTo??from))));
  if(context.coverage==="complete"&&!unknown&&!(isMonthlyForm(mode)&&context.competition==="postseason"))for(const [id,rows] of grouped){
    const batting=rows.b.filter(r=>r.date>=from&&r.date<=to),pitching=rows.p.filter(r=>r.date>=from&&r.date<=to&&r.role===(category==="starters"?"starter":"reliever"));
    if((category==="batting"?batting.length:pitching.length)===0)continue;
    const metrics=mlbProductMetrics(category==="batting"?battingAggregate(id,batting,from,to).metrics:pitchingAggregate(id,pitching,from,to).metrics,category==="batting"?"batting":"pitching")!;
    const value=(key:string)=>(metrics as Record<string,{value:number|null}>)[key]?.value??null;
    const sample=value(policy.sample),rate=value(category==="batting"?"OPS":"ERA"),minimum=isMonthlyForm(mode)?policy.monthly:policy.minimum[days];
    const eligible=sample!==null&&sample>=minimum&&rate!==null&&(category==="batting"?["HR","H"].every(k=>value(k)!==null):value("K9")!==null&&pitching.length>=Math.ceil((isMonthlyForm(mode)?28:days)/7)*(category==="relievers"?2:1));
    if(isFormComparison(mode)||eligible)expected.set(id,metrics);
  }
  const actualIds=actual.map(e=>e.playerId);
  if(new Set(actualIds).size!==actualIds.length||actualIds.length!==expected.size||actualIds.some(id=>!expected.has(id)))throw Error(`Form player population mismatch ${context.competition}/${to}/${mode}/${category}`);
  return expected;
}

/** Independent window aggregates from immutable Game Facts, never the projection builder. */
export async function verifyHistoricalForm(root: string) {
  const start = performance.now(); let gamesChecked=0, comparisons=0, windows=0, maxMs=0, maxEntries=0, files=0, bytes=0, largest=0;
  const scopes=[];
  for (const competition of ["regular","postseason"] as const) {
    const prefix=competition==="regular"?"":"postseason/",base=join(root,prefix);
    const read=async<T>(path:string):Promise<T>=>{const b=await readFile(join(base,path+".gz"));const v:unknown=JSON.parse(gunzipSync(b).toString());if(!validStaticPayload(prefix+path,v))throw Error(`Invalid ${path}`);return v as T;};
    const manifest=await read<{seasons:{season:number;coverage:string}[]}>("manifest.json"),directory=await read<{players:{id:string;name:string}[]}>("players/index.json");
    const names=new Map(directory.players.map(p=>[p.id,p.name])),games: {game:HistoricalGame;hash:string}[]=[];
    for(const f of (await readdir(join(base,"games"))).sort())if(f.endsWith(".json.gz")){const b=await readFile(join(base,"games",f));games.push({game:(await read<{game:HistoricalGame}>(`games/${f.slice(0,-3)}`)).game,hash:createHash("sha256").update(b).digest("hex")});}
    for(const {season,coverage} of manifest.seasons) {
      const year=games.filter(g=>g.game.season===season),index=formIndexSchema.parse(await read(`exploration/form/${season}/index.json`));
      const fingerprint=createHash("sha256").update(year.sort((a,b)=>a.game.id.localeCompare(b.game.id)).map(g=>`${g.game.id}:${g.hash}`).join("\n")).digest("hex");
      if(fingerprint!==index.sourceFingerprint||year.length!==index.gameCount)throw Error("Form immutable source fingerprint mismatch");
      if(index.coverage!==coverage)throw Error("Form source coverage mismatch");
      const sourceMonths=[...new Set(year.map(g=>g.game.date.slice(0,7)))].sort(),sourceDates=year.map(g=>g.game.date).sort();
      if(JSON.stringify(sourceMonths)!==JSON.stringify(index.months.map(m=>m.month).sort())||index.firstDate!==sourceDates[0]||index.lastDate!==sourceDates.at(-1))throw Error("Form source period/month population mismatch");
      const months=await Promise.all(index.months.map(async m=>{const path=`exploration/form/${season}/${m.month}.json`,b=await readFile(join(base,path+".gz")),v=formMonthSchema.parse(await read(path));if(b.length!==m.compressedBytes||v.batting.length+v.starters.length+v.relievers.length+v.unknown.length!==m.rows)throw Error("Form descriptor mismatch");files++;bytes+=b.length;largest=Math.max(largest,b.length);return v;}));
      const grouped=new Map<string,{b:DatedBatter[];p:DatedPitcher[]}>();
      for(const {game} of year)for(const kind of ["batting","pitching"] as const)for(const fact of game[kind]){const r={...fact,date:game.date,season:game.season,gameId:game.id,home:fact.teamId===game.homeTeamId,opponentTeamId:fact.teamId===game.homeTeamId?game.awayTeamId:game.homeTeamId};const rows=grouped.get(fact.playerId)??{b:[],p:[]};if(kind==="batting")rows.b.push(r as DatedBatter);else rows.p.push(r as DatedPitcher);grouped.set(fact.playerId,rows);}
      if(index.roles.length!==grouped.size||index.roles.some(role=>!grouped.has(role.playerId)))throw Error("Form source role population mismatch");
      // Every month and all windows at the season midpoint/end, in both independent roles.
      const dates=[...new Set([...months.map(m=>year.filter(g=>g.game.date.startsWith(m.month)).map(g=>g.game.date).sort().at(-1)!),new Date((Date.parse(index.firstDate)+Date.parse(index.lastDate))/2).toISOString().slice(0,10)])];
      for(const date of dates)for(const mode of ["hot","change","monthly","monthly-change"] as const)for(const days of (isMonthlyForm(mode)?[7] as const:[7,14,30] as const))for(const category of ["batting","starters","relievers"] as const){
        const required=formMonths(index,date,days,mode),t=performance.now(),result=evaluateHistoricalForm(index,months.filter(m=>required.includes(m.month)),names,date,days,mode,category,"all");maxMs=Math.max(maxMs,performance.now()-t);maxEntries=Math.max(maxEntries,result.entries.length);windows++;
        const population=verifyFormPopulation(grouped,{category,mode,days,competition,coverage:index.coverage,from:result.from,to:result.to,previousFrom:result.previous.from,previousTo:result.previous.to},result.entries);
        for(const entry of result.entries){const rows=grouped.get(entry.playerId)!;const expected=population.get(entry.playerId)!;
          for(const [key,actual] of Object.entries(entry.metrics)){const e=(expected as Record<string,{value:number|null}>)[key];if(!e)continue;comparisons++;if(actual.value===null?e.value!==null:e.value===null||Math.abs(actual.value-e.value)>1e-10)throw Error(`Form mismatch ${competition}/${season}/${date}/${category}/${entry.playerId}/${key}`);}
          if(isFormComparison(mode)&&entry.delta!==null){const previous=category==="batting"?battingAggregate(entry.playerId,rows.b,result.previous.from,result.previous.to).metrics.OPS.value:pitchingAggregate(entry.playerId,rows.p.filter(p=>p.role===(category==="starters"?"starter":"reliever")),result.previous.from,result.previous.to).metrics.ERA.value;if(previous!==entry.previous)throw Error("Previous window mismatch");comparisons++;}
        }
      }
      gamesChecked+=year.length;scopes.push({season,competition,games:year.length,unknownRoleRows:months.reduce((n,m)=>n+m.unknown.length,0),twoWayEvidence:index.roles.filter(r=>r.twoWayEvidence).length});
    }
  }
  return {result:"PASS",gamesChecked,windows,metricComparisons:comparisons,mismatches:0,scopes,monthFiles:files,monthBytes:bytes,largestPayload:largest,maxEvaluationMs:Math.round(maxMs),maxEntries,renderLimit:20,maxMonthlyFetches:3,canonicalWrites:0,queries:0,elapsedMs:Math.round(performance.now()-start)};
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("verify-historical-form.ts")){const report=await verifyHistoricalForm(process.argv[2]??"dist/data/mlb/historical");await writeFile(process.argv[3]??".data/historical-form-validation.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
