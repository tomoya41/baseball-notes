// Explicit CC0 presentation metadata refresh. No MLB Current collection.
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import { z } from "zod";
import { historicalId } from "../src/data/mlb-historical";
import reviewed from "../src/data/mlb-japan-reviewed-entities.json";
const path = ".data/mlb-japan-cohort-source.json";
if (process.argv.includes("--fetch")) {
  const query = `SELECT DISTINCT ?entity ?retro ?mlbam WHERE {
    ?entity <http://www.wikidata.org/prop/direct/P27> <http://www.wikidata.org/entity/Q17>.
    { { ?entity <http://www.wikidata.org/prop/direct/P6976> ?retro }
      UNION { ?entity <http://www.wikidata.org/prop/direct/P3541> ?mlbam } }
  }`;
  const response = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "BaseballNotes/1.0 (CC0 identity metadata; https://github.com/tomoya41/baseball-notes)", Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(50000),
  });
  if (!response.ok) throw Error(`CC0 metadata unavailable: ${response.status}`);
  await writeFile(path, await response.text());
}
const field = z.object({ value: z.string().min(1) });
const source = z.object({ results: z.object({ bindings: z.array(z.object({ entity: field, retro: field.optional(), mlbam: field.optional() })) }) }).parse(JSON.parse(await readFile(path, "utf8")));
const index = JSON.parse(await readFile(".data/mlb-public/data/mlb/historical/players/index.json", "utf8")) as { players: { id: string; name: string }[] };
const ids = new Set(index.players.map(p => p.id));
const bindings = new Map<string, Set<string>>();
for (const b of source.results.bindings) for (const key of [b.retro && `retro:${b.retro.value}`, b.mlbam && `mlbam:${b.mlbam.value}`]) if (key) {
  const values = bindings.get(key) ?? new Set<string>(); values.add(b.entity.value); bindings.set(key, values);
}
const entries = unzipSync(await readFile(".data/chadwick-register.zip"), { filter: file => /\/data\/people-[0-9a-f]\.csv$/.test(file.name) });
if (Object.keys(entries).length !== 16) throw Error("Incomplete identity register");
const output: Record<string, string> = {};
for (const content of Object.values(entries)) for (const row of parse(content, { columns: true }) as Record<string, string>[]) {
  const id = historicalId("player", `chadwick:${row.key_uuid}`); if (!ids.has(id)) continue;
  const candidates = new Set([...(bindings.get(`retro:${row.key_retro}`) ?? []), ...(bindings.get(`mlbam:${row.key_mlbam}`) ?? [])]);
  if (candidates.size !== 1) continue;
  const entity = [...candidates][0]!;
  if (!reviewed.entities.includes(entity.split("/").at(-1)!)) continue;
  if (row.key_wikidata && !entity.endsWith(`/${row.key_wikidata}`)) continue;
  output[id] = entity.replace("http:", "https:");
}
await writeFile("src/data/mlb-japan-cohort.json", `${JSON.stringify({ license: "CC0-1.0", accessedDate: new Date().toISOString().slice(0, 10), criterion: "Wikidata P27 includes Japan (Q17); exact Retrosheet/MLBAM to Chadwick mapping; reviewed entity allowlist; not name inference", players: output }, null, 2)}\n`);
console.log(JSON.stringify({ count: Object.keys(output).length, players: index.players.filter(p => output[p.id]).map(p => ({ id: p.id, name: p.name })) }));
