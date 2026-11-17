import { mkdir,writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gameManifestSchema,recentGamesSchema } from "../src/domain/npb-game-index";
import { recordsSchema } from "../src/domain/npb-records";
import { npbCatalogSchema,npbCapabilitiesSchema,npbTeamSeasonSchema } from "../src/domain/npb-product-contract";
import { npbSeasonMilestonesSchema } from "../src/domain/npb-season-milestones";
import { fetchNpbPublicGameSurface } from "./lib/fetch-npb-public-game-surface";
import { preserveNpbPublicGameDates } from "./lib/preserve-npb-public-game-dates";
async function fetchJson(path:string){const r=await fetchNpbPublicGameSurface(path);
  if(!r.ok)throw Error(`Surface preservation HTTP ${r.status}: ${path}`);return r.json() as Promise<unknown>;}
async function save(path:string,value:unknown){const p=`dist/data/npb/${path}`;await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(value));}
const response=await fetchNpbPublicGameSurface("games/manifest.json");
if(response.status===404){console.log("No prior Game surface to preserve");}
else {if(!response.ok)throw Error("Game manifest preservation failed");const manifest=gameManifestSchema.parse(await response.json());
  const dates=await preserveNpbPublicGameDates("dist/data/npb",manifest);
  await save("games/recent.json",recentGamesSchema.parse(await fetchJson("games/recent.json")));
  await save("records/2026/latest.json",recordsSchema.parse(await fetchJson("records/2026/latest.json")));
  // Additive contract rollout: old deployments have no catalog. Once present, preserve all three validated files.
  const catalogResponse=await fetchNpbPublicGameSurface("catalog/latest.json");
  if(catalogResponse.status!==404){
    if(!catalogResponse.ok)throw Error("Catalog preservation failed");
    const catalog=npbCatalogSchema.parse(await catalogResponse.json());
    const capabilities=npbCapabilitiesSchema.parse(await fetchJson("capabilities.json"));
    const teamSeason=npbTeamSeasonSchema.parse(await fetchJson("teams/season/2026/latest.json"));
    if(catalog.effectiveDate!==capabilities.effectiveDate||catalog.effectiveDate!==teamSeason.effectiveDate)
      throw Error("Product contract preservation effective dates disagree");
    await save("catalog/latest.json",catalog);await save("capabilities.json",capabilities);
    await save("teams/season/2026/latest.json",teamSeason);
    // Legacy deployments do not have this additive capability. Once advertised, losing it is a publish error.
    if(capabilities.data.seasonMilestones?.available){
      const path=`milestones/${teamSeason.season}/latest.json`,milestones=npbSeasonMilestonesSchema.parse(await fetchJson(path));
      if(milestones.season!==teamSeason.season||milestones.effectiveDate!==catalog.effectiveDate)
        throw Error("Milestone preservation identity mismatch");
      await save(path,milestones);
    }
  }
  await save("games/manifest.json",manifest);console.log(`Preserved ${dates} validated dated Game payloads`);
}
