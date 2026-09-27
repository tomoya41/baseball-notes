import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { npbSeasonPayloadSchema } from "../src/application/npb-season-payload";
const path="dist/data/npb/season/2026/latest.json";
try {
  const response=await fetch(`https://tomoya41.github.io/baseball-notes/data/npb/season/2026/latest.json?v=${Date.now()}`,
    {cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(response.status===404) console.log("No previously published season payload");
  else {
    if(!response.ok) throw new Error(`Season preservation HTTP ${response.status}`);
    const payload=npbSeasonPayloadSchema.parse(await response.json());
    await mkdir(dirname(path),{recursive:true});await writeFile(`${path}.tmp`,JSON.stringify(payload));
    npbSeasonPayloadSchema.parse(JSON.parse(await readFile(`${path}.tmp`,"utf8")));await rename(`${path}.tmp`,path);
    console.log("Preserved validated Season payload");
  }
} catch { console.log("Season preservation skipped: published payload unavailable or invalid"); }
