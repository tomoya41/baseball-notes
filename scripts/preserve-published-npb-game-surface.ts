import { mkdir,writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gameManifestSchema,gameDateIndexSchema,recentGamesSchema,shiftGameDate } from "../src/domain/npb-game-index";
import { recordsSchema } from "../src/domain/npb-records";
const base="https://tomoya41.github.io/baseball-notes/data/npb/";
async function fetchJson(path:string){const r=await fetch(base+path,{cache:"no-cache",signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error(`Surface preservation HTTP ${r.status}`);return r.json() as Promise<unknown>;}
async function save(path:string,value:unknown){const p=`dist/data/npb/${path}`;await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(value));}
const response=await fetch(base+"games/manifest.json",{cache:"no-cache",signal:AbortSignal.timeout(15000)});
if(response.status===404){console.log("No prior Game surface to preserve");}
else {if(!response.ok)throw Error("Game manifest preservation failed");const manifest=gameManifestSchema.parse(await response.json());
  const dates:string[]=[];for(let d=manifest.from;d<=manifest.to;d=shiftGameDate(d,1))dates.push(d);
  for(let i=0;i<dates.length;i+=8)await Promise.all(dates.slice(i,i+8).map(async date=>{
    const path=`games/dates/${date}.json`;const p=gameDateIndexSchema.parse(await fetchJson(path));if(p.date!==date)throw Error("Dated payload mismatch");await save(path,p);}));
  await save("games/recent.json",recentGamesSchema.parse(await fetchJson("games/recent.json")));
  await save("records/2026/latest.json",recordsSchema.parse(await fetchJson("records/2026/latest.json")));
  await save("games/manifest.json",manifest);console.log(`Preserved ${dates.length} validated dated Game payloads`);
}
