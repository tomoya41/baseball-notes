import { mkdir,writeFile } from "node:fs/promises";
import { readMlbWeekly,type WeeklyManifest } from "../src/application/mlb-weekly";
import { formIndexSchema } from "../src/domain/historical-form";
import { calendarWeek } from "../src/domain/weekly-analysis";
import { shiftGameDate } from "../src/domain/npb-game-index";
import { prepareWeeklyAiInput } from "../src/data/weekly-ai-insights";
import { battingAggregate,pitchingAggregate,type DatedBatter,type DatedPitcher } from "../src/domain/mlb-historical-aggregate";
import { weeklyPublicReader } from "./lib/weekly-public-reader";

const reader=weeklyPublicReader(),regular=await reader.read<WeeklyManifest>("manifest.json"),postseason=await reader.read<WeeklyManifest>("postseason/manifest.json"),indexes=[];
for(const [competition,manifest] of [["regular",regular],["postseason",postseason]] as const){
  for(const d of manifest.seasons){const i=formIndexSchema.parse(await reader.read(`${competition==="postseason"?"postseason/":""}exploration/form/${d.season}/index.json`));
    if(i.season!==d.season||i.competitionType!==competition||i.gameCount!==d.games||i.firstDate!==d.firstDate||i.lastDate!==d.lastDate||i.coverage!==d.coverage)throw Error("Weekly published index mismatch");
    indexes.push({season:d.season,competition,coverage:i.coverage,sourceFingerprint:i.sourceFingerprint});}
}
const examples=[];
let independentPlayerChecks=0;
for(const [season,competition] of [[2014,"regular"],[2025,"regular"],[2025,"postseason"]] as const){
  const manifest=competition==="regular"?regular:postseason,d=manifest.seasons.find(d=>d.season===season);if(!d)throw Error("Missing expected saved season");
  const date=season===2025&&competition==="regular"?"2025-09-22":calendarWeek(shiftGameDate(d.firstDate,14)).from;
  const report=await readMlbWeekly(manifest,season,date,competition,reader.read),input=prepareWeeklyAiInput(report);
  if(season===2025&&competition==="regular")for(const category of ["batting","starters","relievers"] as const){
    for(const e of report.hot[category].slice(0,category==="batting"?3:1)){
      const profile=await reader.read<{player:{id:string};batting:DatedBatter[];pitching:DatedPitcher[]}>(`players/${e.playerId.replaceAll(":","_")}.json`);
      if(profile.player.id!==e.playerId)throw Error("Independent weekly Player identity mismatch");
      const from=report.summary.week.from,to=report.summary.week.to;
      const reference=category==="batting"?battingAggregate(e.playerId,profile.batting,from,to):pitchingAggregate(e.playerId,profile.pitching.filter(p=>p.role===(category==="starters"?"starter":"reliever")),from,to);
      for(const key of category==="batting"?["G","PA","AB","H","HR","RBI","AVG","OPS"]:["G","outsRecorded","ER","SO","ERA","K9"]){
        const a=e.metrics[key]?.value??null,b=reference.metrics[key]?.value??null;
        if(a===null||b===null?a!==b:Math.abs(a-b)>1e-12)throw Error(`Independent weekly metric mismatch: ${key}`);
      }
      independentPlayerChecks++;
    }
  }
  examples.push({season,competition,week:report.summary.week,coverage:report.summary.coverage,games:report.summary.games.length,hot:Object.fromEntries(Object.entries(report.hot).map(([key,entries])=>[key,entries.map(e=>({playerId:e.playerId,name:e.name,metrics:e.metrics,previous:e.previous,delta:e.delta}))])),rising:report.rising.map(e=>({playerId:e.playerId,name:e.name,category:e.category,previous:e.previous,delta:e.delta})),inputSha256:input.inputSha256,fetches:report.fetches});
}
await mkdir(".data/weekly-analysis",{recursive:true});
await writeFile(".data/weekly-analysis/audit.json",JSON.stringify({checkedAt:new Date().toISOString(),indexes,examples,independentPlayerChecks,staticReads:reader.stats(),aiRequests:0,canonicalWrites:0},null,2));
console.log(JSON.stringify({status:"PASS",indexes:indexes.length,examples:examples.map(e=>({season:e.season,competition:e.competition,week:e.week,games:e.games,coverage:e.coverage,fetches:e.fetches})),independentPlayerChecks,staticReads:reader.stats(),aiRequests:0,canonicalWrites:0}));
