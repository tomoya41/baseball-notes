import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { z } from "zod";
import currentPin from "../src/data/baseball-context-release.json";
import retainedPins from "../src/data/baseball-context-retained-releases.json";
import profileIdentities from "../src/data/npb-free-profile-identities.json";
import annualReview from "./data/npb-2026-honors.json";
import gloveReview from "./data/npb-2026-golden-glove.json";
import { buildHonorCatalog, honorRecipientBucket } from "../src/domain/honor-discovery";
import { contextManifestSchema, honorsPageSchema, honorsSourceSchema, playerHonorBucket, type Honor, type HonorRecipient } from "../src/domain/player-honors";
import { npbTeamShortName } from "../src/presentation/npb-team-names";

const goldenGlove = process.argv.includes("--golden-glove");
const output = ".data/npb-awards-2026";
const baseSha = goldenGlove
  ? "1f3c1c6a2279422740a713df9fe7dede4ff54c53beeee29cc69d5ff192add8e8"
  : "e6bd72ce02c1e22f7d4d69b051df97fe24a4474f6759222feb379f56583d7e12";
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const described = (value: unknown) => {
  const text = JSON.stringify(value);
  return { sha256: sha(text), bytes: Buffer.byteLength(text) };
};
const basePin = [currentPin, ...retainedPins].find(pin => pin.sha256 === baseSha);
if (!basePin) throw Error("Original historical honors pin is missing");
const baseBytes = await readFile(`.data/baseball-context/${baseSha}.gz`);
if (sha(baseBytes) !== basePin.sha256) throw Error("Original archive hash mismatch");
const baseBody = gunzipSync(baseBytes, { maxOutputLength: 25_000_000 });
if (sha(baseBody) !== basePin.bodySha256) throw Error("Original archive body mismatch");
const archiveSchema = z.strictObject({ schemaVersion: z.literal(1), files: z.record(z.string(), z.unknown()) });
const base = archiveSchema.parse(JSON.parse(baseBody.toString()));
const manifest = contextManifestSchema.parse(base.files["manifest.json"]);
const originalManifest = described(base.files["manifest.json"]);
if (manifest.cutoff !== (goldenGlove ? 2026 : 2025) || originalManifest.sha256 !== basePin.manifestSha256 || originalManifest.bytes !== basePin.manifestBytes
  || Object.keys(base.files).length !== Object.keys(manifest.files).length + 1) throw Error("Original manifest mismatch");
for (const [path, expected] of Object.entries(manifest.files)) {
  const actual = described(base.files[path]);
  if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) throw Error(`Original projection mismatch: ${path}`);
}

const directoryBytes = await readFile(`${output}/directory.json`);
const directoryProof = "449d871fe70249cf971f504c2eace5163b10ad6759927bf06c5e7f2acee35e70";
if (sha(directoryBytes) !== directoryProof) throw Error("Reviewed public Directory hash mismatch");
const directory = z.object({ league: z.literal("NPB"), players: z.array(z.object({
  playerId: z.uuid(), battingAvailable: z.boolean(), pitchingAvailable: z.boolean(),
})) }).parse(JSON.parse(directoryBytes.toString()));
const published = new Map(directory.players.map(player => [player.playerId, player]));

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const npbId = z.string().regex(/^\d{8}$/);
const awardId = z.enum(["npb_mvp", "npb_roy", "npb_bestnine", "npb_glove"]);
const position = z.enum(["投手部門", "捕手部門", "一塁手部門", "二塁手部門", "三塁手部門", "遊撃手部門", "外野手部門", "指名打者部門"]);
const admission = z.strictObject({
  year: z.literal(2026), verifiedAt: z.iso.datetime(), sources: z.partialRecord(awardId, honorsSourceSchema),
  recipients: z.record(npbId, z.strictObject({
    name: z.string().min(1), articlePageId: z.number().int().positive(), articleRevision: z.number().int().positive(), articleSha256: hash,
    binding: z.strictObject({ playerId: z.uuid(), wikidataId: z.string().regex(/^Q\d+$/), chadwickId: z.uuid(), seasonAvailable: z.boolean() }).nullable(),
  })),
  records: z.array(z.tuple([npbId, awardId, z.enum(["CL", "PL"]), z.string(), position.nullable(), hash])),
}).parse(goldenGlove ? gloveReview : annualReview);
const categories = goldenGlove ? ["npb_glove"] : ["npb_mvp", "npb_roy", "npb_bestnine"];
const sourceIds = Object.keys(admission.sources);
if (sourceIds.length !== categories.length || categories.some(id => !sourceIds.includes(id))
    || admission.records.some(row => !categories.includes(row[1]))) throw Error("Unexpected reviewed award category");
const teams = {
  CL: ["tigers", "giants", "baystars", "dragons", "swallows", "carp"],
  PL: ["hawks", "lions", "marines", "fighters", "buffaloes", "eagles"],
};
for (const division of ["CL", "PL"] as const) {
  const rows = admission.records.filter(row => row[2] === division);
  const expected = ["投手部門", "捕手部門", "一塁手部門", "二塁手部門", "三塁手部門", "遊撃手部門", "外野手部門", "外野手部門", "外野手部門"];
  if (!goldenGlove && division === "PL") expected.push("指名打者部門");
  const fielders = rows.filter(row => row[1] === (goldenGlove ? "npb_glove" : "npb_bestnine"));
  const singles = goldenGlove ? [] : ["npb_mvp", "npb_roy"];
  if (JSON.stringify(fielders.map(row => row[4])) !== JSON.stringify(expected) ||
      new Set(fielders.map(row => row[0])).size !== expected.length ||
      singles.some(id => rows.filter(row => row[1] === id && row[4] === null).length !== 1) ||
      rows.length !== expected.length + singles.length || rows.some(row => !teams[division].includes(row[3]))) {
    throw Error(`Incomplete or duplicate reviewed award category: ${division}`);
  }
}

const historical = Object.entries(base.files).filter(([path]) => path.startsWith("honors/recipients/NPB/"))
  .map(([, value]) => honorsPageSchema.parse(value));
const previousRecipients = new Map(historical.flatMap(page => page.recipients.map(recipient => [recipient.id, recipient])));
const recipients = new Map(previousRecipients);
const adopted: Honor[] = [];
const names = { npb_mvp: "最優秀選手賞", npb_roy: "最優秀新人賞", npb_bestnine: "ベストナイン", npb_glove: "三井ゴールデン・グラブ賞" };
for (const [id, record] of Object.entries(admission.recipients)) {
  const recipientId = `npb:${id}`;
  const old = previousRecipients.get(recipientId);
  const recipient: HonorRecipient = old ? structuredClone(old) : {
    id: recipientId, name: record.name, identityStatus: "unresolved", externalIds: { npb: id }, links: [], counts: {},
  };
  if (record.binding) {
    const binding = record.binding;
    const profile = published.get(binding.playerId);
    const verified = profileIdentities.filter(row => row.npbId === id && row.playerId === binding.playerId
      && row.wikidataId === binding.wikidataId && row.verificationStatus === "source_verified"
      && row.chadwick?.uuid === binding.chadwickId);
    const oldLink = recipient.links.find(link => link.league === "NPB");
    if (!profile || verified.length !== 1 || binding.seasonAvailable !== (profile.battingAvailable || profile.pitchingAvailable)
      || (oldLink && oldLink.playerId !== binding.playerId)) throw Error(`Published profile evidence conflict: ${id}`);
    const seasons = [...new Set([...(oldLink?.seasons ?? []), ...(binding.seasonAvailable ? [admission.year] : [])])];
    if (oldLink) oldLink.seasons = seasons;
    else recipient.links.push({ league: "NPB", playerId: binding.playerId, seasons });
    recipient.identityStatus = "verified";
    recipient.externalIds.wikidata = binding.wikidataId;
  }
  const rows = admission.records.filter(row => row[0] === id);
  if (!rows.length) throw Error(`Unused award review: ${id}`);
  for (const [, category, division, club, slot, proof] of rows) {
    const teamId = `npb:team:${club}`;
    const awardSource = admission.sources[category];
    if (!awardSource) throw Error(`Missing award source: ${category}`);
    recipient.counts[category] = (recipient.counts[category] ?? 0) + 1;
    adopted.push({ id: sha(`${recipientId}:${category}:${admission.year}:${slot ?? ""}`), recipientId, league: "NPB",
      year: admission.year, division, awardId: category, name: names[category], sourceName: names[category], kind: "award",
      position: slot, seasonTeams: [{ id: teamId, name: npbTeamShortName(teamId) }], joint: null,
      sourceId: awardSource.id, evidenceSha256: proof, reportedCareerWins: null });
  }
  recipients.set(recipientId, recipient);
}
if (adopted.length !== admission.records.length || new Set(adopted.map(row => row.id)).size !== adopted.length) {
  throw Error("Duplicate award ID or missing recipient");
}

const files = { ...base.files };
const oldNpbRows = historical.flatMap(page => page.records);
const oldIds = new Set(oldNpbRows.map(row => row.id));
if (adopted.some(row => oldIds.has(row.id))) throw Error("Existing award row would be duplicated");
const allNpbRows = [...oldNpbRows, ...adopted];
const candidateBuckets = new Map<string, Honor[]>();
for (const row of adopted) {
  const paths = [`honors/recipients/NPB/${honorRecipientBucket(row.recipientId)}.json`];
  const playerId = recipients.get(row.recipientId)!.links.find(link => link.league === "NPB")?.playerId;
  if (playerId) paths.push(`honors/players/NPB/${playerHonorBucket(playerId)}.json`);
  for (const path of paths) candidateBuckets.set(path, [...(candidateBuckets.get(path) ?? []), row]);
}
candidateBuckets.set(`honors/years/NPB/${admission.year}.json`, adopted);
const newSources = Object.values(admission.sources);
const paths = [...new Set([...candidateBuckets.keys(), ...Object.keys(base.files).filter(path => /^honors\/(?:years|players|recipients)\/NPB\//.test(path))])];
for (const path of paths) {
  const old = base.files[path] ? honorsPageSchema.parse(base.files[path]) : { schemaVersion: 1 as const, records: [], recipients: [], sources: [] };
  const added = candidateBuckets.get(path) ?? [];
  const updated = old.recipients.map(recipient => recipients.get(recipient.id) ?? recipient);
  if (!added.length && updated.every((recipient, index) => JSON.stringify(recipient) === JSON.stringify(old.recipients[index]))) continue;
  const index = new Map(updated.map(recipient => [recipient.id, recipient]));
  for (const row of added) index.set(row.recipientId, recipients.get(row.recipientId)!);
  files[path] = honorsPageSchema.parse({ schemaVersion: 1, records: [...old.records, ...added], recipients: [...index.values()],
    sources: [...old.sources, ...newSources.filter(source => added.some(row => row.sourceId === source.id))] });
}
files["honors/catalog/NPB.json"] = buildHonorCatalog("NPB", allNpbRows, [...recipients.values()]);
const linked = (recipientId: string) => recipients.get(recipientId)!.links.some(link => link.league === "NPB");
const counts = { ...manifest.counts, NPBRows: allNpbRows.length, NPBRecipients: recipients.size,
  NPBLinkedRows: allNpbRows.filter(row => linked(row.recipientId)).length,
  NPBUnlinkedRecipients: [...recipients.keys()].filter(id => !linked(id)).length };
for (const [path, value] of Object.entries(base.files)) {
  if (path !== "manifest.json" && !/^honors\/(?:catalog\/NPB\.json|(?:years|players|recipients)\/NPB\/)/.test(path)
    && described(files[path]).sha256 !== described(value).sha256) throw Error(`Unrelated projection changed: ${path}`);
}
const projections = Object.fromEntries(Object.entries(files).filter(([path]) => path !== "manifest.json")
  .map(([path, value]) => [path, described(value)]));
files["manifest.json"] = contextManifestSchema.parse({ ...manifest, observedAt: admission.verifiedAt, cutoff: admission.year,
  attribution: goldenGlove
    ? manifest.attribution.replace("Best Nine winners only", "Best Nine and Golden Glove winners")
    : manifest.attribution.replace(" or 2026 awards", "") + " The 2026 NPB supplement adds verified MVP, Rookie of the Year, and Best Nine winners only; data are partial.",
  years: { ...manifest.years, NPB: [admission.year, ...manifest.years.NPB.filter(year => year !== admission.year)] }, counts, files: projections });
const body = Buffer.from(JSON.stringify({ schemaVersion: 1, files }));
const compressed = gzipSync(body, { level: 9 });
if (body.length > 25_000_000 || compressed.length > 5_000_000) throw Error("Context release size budget exceeded");
const newManifest = described(files["manifest.json"]);
const report = { sha256: sha(compressed), bodySha256: sha(body), manifestSha256: newManifest.sha256,
  manifestBytes: newManifest.bytes, publishedFiles: Object.keys(files).length, counts,
  added: adopted.length, verifiedNewProfileLinks: [...Object.values(admission.recipients)].filter(record => !!record.binding).length };
await mkdir(output, { recursive: true });
await writeFile(`${output}/context.json.gz`, compressed);
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
