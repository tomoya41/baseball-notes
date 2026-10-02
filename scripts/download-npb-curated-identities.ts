import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { discoverNpbIdentityCandidates, verifyNpbIdentityCandidate } from "../src/infrastructure/providers/wikidata-npb-identity";
import previous from "../src/data/npb-free-profile-identities.json";

const [folder = ".data/npb-free2"] = process.argv.slice(2);
await mkdir(folder, { recursive: true });
const directory = npbPlayerDirectorySchema.parse(JSON.parse(await readFile(`${folder}/players-before.json`, "utf8")));
let indexText: string;
try { indexText = await readFile(`${folder}/identity-index.json`, "utf8"); } catch {
  const query = `SELECT DISTINCT ?item ?npb ?name ?team WHERE {
    VALUES ?team { ${Object.keys((await import("../src/infrastructure/providers/wikidata-npb-identity")).wikidataNpbTeams).map(id => `wd:${id}`).join(" ")} }
    ?item wdt:P4260 ?npb; wdt:P54 ?team.
    { ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name } FILTER(LANG(?name)="ja") }`;
  const url = new URL("https://query.wikidata.org/sparql"); url.search = new URLSearchParams({ query, format: "json" }).toString();
  const res = await fetch(url, { headers: { "User-Agent": "BaseballNotes-curated-profile/2.0 (https://github.com/tomoya41/baseball-notes)" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Error(`WDQS HTTP ${res.status}`);
  indexText = await res.text(); await writeFile(`${folder}/identity-index.json`, indexText);
}
const candidates = discoverNpbIdentityCandidates(JSON.parse(indexText), directory);
const ids = [...new Set([...previous.map(b => b.wikidataId), ...candidates.flatMap(c => c.candidates.map(v => v.wikidataId))])];
const entities: Record<string, unknown> = {}, at = new Date().toISOString();
try { Object.assign(entities, JSON.parse(await readFile(`${folder}/claims.json`, "utf8")).entities); } catch { /* first import */ }
const missing = ids.filter(id => !entities[id]);
let requests = 0, bytes = 0;
for (let i = 0; i < missing.length; i += 40) {
  const chunk = missing.slice(i, i + 40);
  const file = `${folder}/entities-${createHash("sha256").update(chunk.join("|")).digest("hex")}.json`;
  let body: string;
  try { body = await readFile(file, "utf8"); }
  catch {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({ action: "wbgetentities", format: "json", languages: "ja|en", props: "claims|labels|aliases|sitelinks|info", ids: chunk.join("|") }).toString();
    const response = await fetch(url, { headers: { "User-Agent": "BaseballNotes-curated-profile/2.0 (https://github.com/tomoya41/baseball-notes)" }, signal: AbortSignal.timeout(30000) });
    requests++; if (!response.ok) throw Error(`Wikidata HTTP ${response.status}`);
    body = await response.text(); await writeFile(file, body); bytes += Buffer.byteLength(body);
  }
  const result = JSON.parse(body); if (result.error) throw Error(result.error.info);
  Object.assign(entities, result.entities);
}
const bridges: unknown[] = [...previous], issues: unknown[] = [];
const indexSha256 = createHash("sha256").update(indexText).digest("hex");
for (const candidate of candidates) {
  if (previous.some(b => b.playerId === candidate.playerId)) continue;
  if (candidate.status !== "candidate") { issues.push({ ...candidate, reason: candidate.status === "ambiguous" ? "identity_ambiguous" : "identity_evidence_insufficient" }); continue; }
  const match = candidate.candidates[0]!, verified = verifyNpbIdentityCandidate(candidate, entities[match.wikidataId], directory.players.find(p => p.playerId === candidate.playerId)!);
  if (!verified.approved) { issues.push({ ...candidate, reason: verified.reason }); continue; }
  bridges.push({ playerId: candidate.playerId, teamId: candidate.teamId, npbId: match.npbId, wikidataId: match.wikidataId,
    verificationStatus: "source_verified", verificationMethod: "automated", verifiedAt: at,
    identityMethod: verified.reason, sourceRevision: verified.sourceRevision, sourceUrl: `https://www.wikidata.org/wiki/${match.wikidataId}`,
    evidence: { canonicalName: candidate.displayName, registeredNames: match.registeredNames, sourceTeamIds: match.sourceTeamIds, npbId: match.npbId, indexSha256 } });
}
for (const key of ["playerId", "wikidataId", "npbId"]) if (new Set(bridges.map(b => Reflect.get(b as object, key))).size !== bridges.length) throw Error(`Duplicate identity ${key}`);
await writeFile(`${folder}/claims.json`, JSON.stringify({ entities }));
await writeFile(`${folder}/exact-bridges.json`, JSON.stringify(bridges, null, 2));
await writeFile(`${folder}/identity-issues.json`, JSON.stringify(issues, null, 2));
console.log(JSON.stringify({ bridges: bridges.length, previous: previous.length, added: bridges.length - previous.length, unresolved: issues.length, requests, bytes }));
