import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readNpbProfileRegistry } from "../src/infrastructure/providers/wikidata-npb-profile-registry";
import { readWikipediaNpbProfile } from "../src/infrastructure/providers/wikipedia-npb-profile";
import { linkChadwickNpb } from "../src/infrastructure/providers/chadwick-npb-identity";
import { wikidataNpbTeams } from "../src/infrastructure/providers/wikidata-npb-identity";
import { profileRegistrySchema, type ProfileRegistryEntry } from "../src/domain/npb-profile-registry";

const [folder = ".data/npb-free2"] = process.argv.slice(2);
const read = async (name: string) => JSON.parse(await readFile(`${folder}/${name}`, "utf8")) as unknown;
const bridges = z.array(z.object({ playerId: z.uuid(), npbId: z.string(), wikidataId: z.string() }).passthrough()).parse(await read("exact-bridges.json"));
const archive = z.object({ observedAt: z.iso.datetime(), pages: z.record(z.string(), z.unknown()), titles: z.array(z.object({ playerId: z.uuid(), npbId: z.string(), wikidataId: z.string(), title: z.string() })) }).parse(await read("wikipedia.json"));
const { observedAt } = archive;
const claims = z.object({ entities: z.record(z.string(), z.object({ claims: z.record(z.string(), z.array(z.object({ rank: z.string().optional(), mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }) }))) }).passthrough()) }).parse(await read("claims.json"));
// Some verified article IDs are not yet present as P4260. That limits the WD
// profile adapter; it does not invalidate an exact article + Chadwick bridge.
const wdBridges = bridges.filter(b => {
  const ids = [...new Set((claims.entities[b.wikidataId]?.claims.P4260 ?? []).filter(c => c.rank !== "deprecated").map(c => c.mainsnak.datavalue?.value))];
  return ids.length === 1 && ids[0] === b.npbId;
});
const wikidata = readNpbProfileRegistry(claims, await read("labels.json"), wdBridges, observedAt, wikidataNpbTeams);
const entries: ProfileRegistryEntry[] = [...wikidata.registry.entries];
const issues: { playerId: string; source: string; reason: string }[] = [];
for (const b of archive.titles) {
  if (!bridges.some(v => v.playerId === b.playerId && v.wikidataId === b.wikidataId && v.npbId === b.npbId)) throw Error("Archive identity mismatch");
  try { entries.push(...readWikipediaNpbProfile(archive.pages[b.title], b, observedAt).entries); }
  catch (e) { issues.push({ playerId: b.playerId, source: b.title, reason: String(e) }); }
}
const chadwickHash = createHash("sha256").update(await readFile(".data/chadwick-register.zip")).digest("hex");
const linked = linkChadwickNpb(await read("chadwick-npb.json"), bridges);
for (const link of linked) if (link.approved && link.birthDate) entries.push({ playerId: link.bridge.playerId,
  field: "birthDate", value: link.birthDate, sourceName: "Chadwick Register", sourceUrl: "https://github.com/chadwickbureau/register",
  license: "ODC-BY-1.0", rightsEvidenceUrl: "https://github.com/chadwickbureau/register/blob/master/README.md", publicReuseAllowed: true,
  verifiedAt: observedAt, observedAt, sourceRevision: chadwickHash, verificationMethod: "automated", verificationStatus: "source_verified",
  effectiveFrom: null, effectiveTo: null, reviewer: "Codex", notes: "Exact key_npb + consistent Wikidata cross-reference; birth date only, no professional spans interpreted as NPB debut", transformation: "Complete birth components normalized to ISO date", additionalSourceUrls: [] });
const registry = profileRegistrySchema.parse({ schemaVersion: 1, observedAt, entries });
await writeFile("src/data/npb-curated-profile-registry.json", `${JSON.stringify(registry)}\n`);
await writeFile("src/data/npb-free-profile-identities.json", `${JSON.stringify(bridges.map(b => {
  const link = linked.find(v => v.bridge.playerId === b.playerId);
  return link?.approved ? { ...b, chadwick: { uuid: link.chadwickId, externalIds: link.externalIds,
    sourceUrl: "https://github.com/chadwickbureau/register", license: "ODC-BY-1.0", archiveSha256: chadwickHash,
    verifiedAt: observedAt, verificationMethod: "automated", identityMethod: "exact_npb_id_and_consistent_wikidata_cross_reference" } } : b;
}), null, 2)}\n`);
await writeFile(`${folder}/normalization-audit.json`, JSON.stringify({ observedAt, entries: entries.length,
  chadwickMatched: linked.filter(v => v.approved).length, chadwickRejected: linked.filter(v => !v.approved),
  chadwickHash, articles: archive.titles.length, issues, wikidataRejected: wikidata.rejected, canonicalWrites: 0 }, null, 2));
console.log(JSON.stringify({ identities: bridges.length, entries: entries.length, articleIssues: issues.length,
  chadwickMatched: linked.filter(v => v.approved).length, canonicalWrites: 0 }));
