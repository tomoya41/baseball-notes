import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

const [folder = ".data/npb-free2"] = process.argv.slice(2);
const read = async (name: string) => JSON.parse(await readFile(`${folder}/${name}`, "utf8")) as unknown;
const bridgeSchema = z.object({ playerId: z.uuid(), wikidataId: z.string(), npbId: z.string() }).passthrough();
const bridges = z.array(bridgeSchema).parse(await read("exact-bridges.json"));
const beforeCount = bridges.length;
const discovery = z.object({ observedAt: z.iso.datetime(), approved: z.array(bridgeSchema.extend({ sourceUrl: z.url(), sourceRevision: z.number(), articleTitle: z.string() })), pages: z.record(z.string(), z.unknown()) }).parse(await read("wikipedia-identity-discovery.json"));
const issues: unknown[] = [];
for (const b of discovery.approved) {
  if (bridges.some(v => v.playerId === b.playerId && v.npbId === b.npbId && v.wikidataId === b.wikidataId)) continue;
  if (discovery.approved.some(v => v.playerId !== b.playerId && (v.npbId === b.npbId || v.wikidataId === b.wikidataId))) { issues.push({ playerId: b.playerId, reason: "identity_ambiguous" }); continue; }
  if (bridges.some(v => v.playerId === b.playerId || v.npbId === b.npbId || v.wikidataId === b.wikidataId)) throw Error("Duplicate augmented identity");
  bridges.push({ ...b, verifiedAt: discovery.observedAt, verificationStatus: "source_verified", verificationMethod: "automated",
    identityMethod: "exact_article_title_or_api_redirect_and_explicit_club_and_unique_npb_id_and_chadwick_cross_reference", license: "CC-BY-SA-4.0" });
}
const archive = z.object({ observedAt: z.iso.datetime(), pages: z.record(z.string(), z.unknown()), titles: z.array(bridgeSchema.extend({ title: z.string() })) }).parse(await read("wikipedia.json"));
for (const b of discovery.approved) if (bridges.some(v => v.playerId === b.playerId) && !archive.titles.some(v => v.playerId === b.playerId)) {
  archive.titles.push({ ...b, title: b.articleTitle }); archive.pages[b.articleTitle] = discovery.pages[b.articleTitle];
}
archive.observedAt = [archive.observedAt, discovery.observedAt].sort().at(-1)!;
const claims = z.object({ entities: z.record(z.string(), z.unknown()) }).parse(await read("claims.json"));
const missing = bridges.filter(b => !claims.entities[b.wikidataId]).map(b => b.wikidataId); let requests = 0;
for (let i = 0; i < missing.length; i += 40) {
  await new Promise(r => setTimeout(r, 1200));
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({ action: "wbgetentities", format: "json", languages: "ja|en", props: "claims|labels|aliases|sitelinks|info", ids: missing.slice(i, i + 40).join("|") }).toString();
  const res = await fetch(url, { headers: { "User-Agent": "BaseballNotes-curated-profile/2.0 (https://github.com/tomoya41/baseball-notes)" }, signal: AbortSignal.timeout(60000) });
  requests++; if (!res.ok) throw Error(`Wikidata HTTP ${res.status}`);
  Object.assign(claims.entities, z.object({ entities: z.record(z.string(), z.unknown()) }).parse(await res.json()).entities);
}
await writeFile(`${folder}/claims.json`, JSON.stringify(claims));
await writeFile(`${folder}/exact-bridges.json`, JSON.stringify(bridges, null, 2));
await writeFile(`${folder}/wikipedia.json`, JSON.stringify(archive));
await writeFile(`${folder}/identity-augmentation-audit.json`, JSON.stringify({ observedAt: discovery.observedAt, requests, added: bridges.length - beforeCount, issues, total: bridges.length }, null, 2));
console.log(JSON.stringify({ identities: bridges.length, added: bridges.length - beforeCount, ambiguous: issues.length, requests }));
