import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { npbSeasonPayloadSchema } from "../src/application/npb-season-payload";
import { npbRecentExplorerSchema } from "../src/application/npb-recent-explorer";
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
// Preserve the entire Recent family, or abort. A new publish must never silently drop a live projection.
const recent = [];
for (const days of [7, 14, 30] as const) {
  const r = await fetch(`https://tomoya41.github.io/baseball-notes/data/npb/explorer/recent/${days}.json?v=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (r.status === 404) { await r.arrayBuffer(); continue; }
  if (!r.ok) throw Error(`Recent preservation HTTP ${r.status}`);
  const body = await r.text(), p = npbRecentExplorerSchema.parse(JSON.parse(body));
  if (p.days !== days) throw Error("Recent preservation period mismatch");
  recent.push({ days, body });
}
if (recent.length && recent.length !== 3) throw Error("Incomplete Recent projection family");
for (const r of recent) {
  const p = `dist/data/npb/explorer/recent/${r.days}.json`; await mkdir(dirname(p), { recursive: true }); await writeFile(p, r.body);
}
