import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { verifiedPlayerMappings } from "../src/data/npb-verified-player-mappings";
import { readReviewedMeasurements } from "../src/infrastructure/providers/wikidata-measurements";
// Manual review only. Never automatically change reviewed source data or canonical Facts.
const file = process.argv.find(a => a.startsWith("--input="))?.slice(8);
const response = file ? null : await fetch("https://www.wikidata.org/w/api.php?" + new URLSearchParams({
  action: "wbgetentities", ids: verifiedPlayerMappings.map(p => p.wikidataId).join("|"), props: "labels|claims", languages: "ja|en", format: "json",
}), { headers: { "User-Agent": "BaseballNotes/0.1 (manual reviewed profiles)" }, signal: AbortSignal.timeout(20000) });
if (response && !response.ok) throw Error(`Wikidata HTTP ${response.status}`);
const body = file ? await readFile(file, "utf8") : await response!.text();
const players = readReviewedMeasurements(JSON.parse(body), verifiedPlayerMappings);
await mkdir(".data/batch-g", { recursive: true });
const review = { observedAt: new Date().toISOString(), effectiveDate: null, source: "Wikidata", license: "CC0",
  sourceIds: verifiedPlayerMappings.map(p => ({ playerId: p.playerId, sourceId: p.wikidataId })),
  sha256: createHash("sha256").update(body).digest("hex"), players };
await writeFile(".data/batch-g/measurement-review.json", JSON.stringify(review, null, 2));
console.log(JSON.stringify({ players, httpRequests: file ? 0 : 1, writesToCanonicalDatabase: 0, autoApply: false }));
