import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";

// Explicit, release-time import only. Official Wikimedia APIs; sequential cached batches.
// Raw articles stay in the ignored archive directory, never in public payloads.
const [folder = ".data/npb-free2"] = process.argv.slice(2);
await mkdir(folder, { recursive: true });
const bridges = z.array(z.object({ playerId: z.uuid(), wikidataId: z.string(), npbId: z.string() }))
  .parse(JSON.parse(await readFile(`${folder}/exact-bridges.json`, "utf8")));
const claims = JSON.parse(await readFile(`${folder}/claims.json`, "utf8")) as { entities: Record<string, {
  claims: Record<string, { mainsnak: { datavalue?: { value: { id?: string } } } }[]>;
  sitelinks?: { jawiki?: { title: string } };
}> };
let requests = 0, retries = 0, bytes = 0;
const ledger: { url: string; sha256: string; bytes: number }[] = [];
async function get(url: URL) {
  const file = `${folder}/response-${createHash("sha256").update(url.href).digest("hex")}.json`;
  let text: string;
  try { text = await readFile(file, "utf8"); }
  catch {
    text = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
      const response = await fetch(url, { headers: { "User-Agent": "BaseballNotes-curated-profile/2.0 (https://github.com/tomoya41/baseball-notes)" }, signal: AbortSignal.timeout(60000) });
      requests++;
      if (!response.ok) {
        if (attempt < 2 && (response.status === 429 || response.status >= 500)) { retries++; continue; }
        throw Error(`Official API HTTP ${response.status}`);
      }
      text = await response.text(); const parsed = JSON.parse(text) as { error?: { info: string } };
      if (parsed.error) throw Error(parsed.error.info);
      bytes += Buffer.byteLength(text); await writeFile(file, text); break;
    }
  }
  ledger.push({ url: url.href, sha256: createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text) });
  return JSON.parse(text) as unknown;
}
const ids = [...new Set(Object.values(claims.entities).flatMap(e => ["P19", "P27", "P69", "P54", "P413", "P647"]
  .flatMap(key => (e.claims[key] ?? []).flatMap(c => c.mainsnak.datavalue?.value?.id ?? []))))];
const labels: Record<string, unknown> = {};
for (let i = 0; i < ids.length; i += 40) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({ action: "wbgetentities", format: "json", languages: "ja|en", props: "labels", ids: ids.slice(i, i + 40).join("|") }).toString();
  Object.assign(labels, z.object({ entities: z.record(z.string(), z.unknown()) }).parse(await get(url)).entities);
}
await writeFile(`${folder}/labels.json`, JSON.stringify({ entities: labels }));
const titles = bridges.flatMap(b => { const title = claims.entities[b.wikidataId]?.sitelinks?.jawiki?.title; return title ? [{ ...b, title }] : []; });
const pages: Record<string, unknown> = {};
for (let i = 0; i < titles.length; i += 10) {
  const url = new URL("https://ja.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "revisions|pageprops", rvprop: "ids|timestamp|content", rvslots: "main", ppprop: "wikibase_item", titles: titles.slice(i, i + 10).map(b => b.title).join("|") }).toString();
  for (const p of z.object({ query: z.object({ pages: z.array(z.object({ title: z.string() }).passthrough()) }) }).parse(await get(url)).query.pages) pages[p.title] = p;
}
const observedAt = new Date().toISOString();
await writeFile(`${folder}/wikipedia.json`, JSON.stringify({ observedAt, titles, pages }));
await writeFile(`${folder}/download-ledger.json`, JSON.stringify({ observedAt, requests, retries, bytes, ledger }, null, 2));
console.log(JSON.stringify({ profiles: bridges.length, labelItems: ids.length, articles: titles.length, requests, retries, bytes }));
