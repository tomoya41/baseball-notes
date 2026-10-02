import { readFile, writeFile } from "node:fs/promises";
import { npbCatalogSchema } from "../src/domain/npb-product-contract";
import { profileRegistrySchema } from "../src/domain/npb-profile-registry";
import registry from "../src/data/npb-free-profile-registry.json";
import wikipedia from "../src/data/npb-wikipedia-profile-registry.json";
import curated from "../src/data/npb-curated-profile-registry.json";
import assisted from "../src/data/npb-codex-assisted-profile-registry.json";

const [folder = ".data/npb-free2"] = process.argv.slice(2);
const report = JSON.parse(await readFile(`${folder}/projected/report.json`, "utf8")) as {
  conflicts: { playerId: string; field: string; reason: string; incoming: unknown }[] };
const before = npbCatalogSchema.parse(JSON.parse(await readFile(`${folder}/input/catalog-latest.json`, "utf8")));
const all = [registry, wikipedia, curated, assisted].flatMap(r => profileRegistrySchema.parse(r).entries);
const entries = report.conflicts.map(c => {
  const player = before.players.find(p => p.playerId === c.playerId)!;
  const sources = all.filter(e => e.playerId === c.playerId && (e.field === c.field || c.reason === "cross_field_position_conflict" && ["position", "knownPositions"].includes(e.field)));
  const conflictingSources = [...new Map(sources.map(e => [JSON.stringify([e.sourceUrl, e.field, e.value]), {
    source: e.sourceName, sourceUrl: e.sourceUrl, license: e.license, sourceRevision: e.sourceRevision ?? null,
    field: e.field, value: e.value, observedAt: e.observedAt ?? e.verifiedAt,
    effectiveFrom: e.effectiveFrom, effectiveTo: e.effectiveTo }])).values()];
  return { playerId: c.playerId, displayName: player.displayName, field: c.field,
    existingValue: Reflect.get(player.profile, c.field) ?? null, candidateValue: c.incoming,
    source: sources.map(e => e.sourceName).filter((v, i, a) => a.indexOf(v) === i), sourceUrl: sources[0]?.sourceUrl ?? null,
    evidence: "Field-specific licensed source claims/revisions disagree; known value retained, nullable value not filled",
    conflictingSources, observedAt: curated.observedAt, effectiveDateCandidate: null,
    unresolvedReason: c.reason === "cross_field_position_conflict" ? "definition_mismatch" : "source_conflict",
    recommendedReviewAction: "Compare source revisions, field definitions and observation dates; obtain explicit evidence. Do not majority-vote or overwrite a known value." };
});
await writeFile("docs/npb-curated-review-queue.json", `${JSON.stringify({ schemaVersion: 1, observedAt: curated.observedAt,
  humanReviewed: 0, note: "Licensed factual candidates retain the per-source license/credit below. This is an exception queue, not completed human review.", entries }, null, 2)}\n`);
console.log(JSON.stringify({ queue: entries.length, reasons: entries.reduce<Record<string, number>>((a, e) => { a[e.unresolvedReason] = (a[e.unresolvedReason] ?? 0) + 1; return a; }, {}) }));
