import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { npbCatalogSchema, npbCapabilitiesSchema } from "../src/domain/npb-product-contract";
import { npbSeasonPayloadSchema } from "../src/application/npb-season-payload";
import { npbHotPayloadSchema } from "../src/application/npb-hot-payload";
import { projectNpbFreeProfiles } from "../src/application/npb-profile-projection";
import { buildNpbCapabilities } from "../src/application/npb-product-payload";
import { buildNpbSeasonMilestones } from "../src/application/npb-season-milestones";

// Local regression over downloaded production contracts. Never connects to canonical storage.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error("Usage: downloaded-snapshot-directory output-directory");
const read = async (name: string) => JSON.parse(await readFile(join(input, name), "utf8")) as unknown;
const directory = npbPlayerDirectorySchema.parse(await read("players-latest.json"));
const before = npbCatalogSchema.parse(await read("catalog-latest.json"));
const oldCapabilities = npbCapabilitiesSchema.parse(await read("capabilities.json"));
const season = npbSeasonPayloadSchema.parse(await read("season-2026-latest.json"));
const hot = npbHotPayloadSchema.parse(await read("hot-latest.json"));
assert.equal(before.effectiveDate, directory.effectiveDate); assert.equal(season.effectiveDate, directory.effectiveDate);
assert.equal(hot.effectiveDate, directory.effectiveDate); assert.equal(oldCapabilities.effectiveDate, directory.effectiveDate);
const started = performance.now(), projection = projectNpbFreeProfiles(directory, before);
const catalog = projection.catalog;
const capabilities = buildNpbCapabilities(catalog, season, hot.readiness), milestones = buildNpbSeasonMilestones(season, catalog);
assert.deepEqual(projection.directory, projectNpbFreeProfiles(projection.directory).directory);
assert.deepEqual(milestones, buildNpbSeasonMilestones(season, catalog));
assert.deepEqual(catalog.teams, before.teams);
assert.deepEqual(catalog.players.map(p => p.playerId), before.players.map(p => p.playerId));
for (const p of before.players) {
  const after = catalog.players.find(v => v.playerId === p.playerId)!;
  assert.equal(after.displayName, p.displayName); assert.deepEqual(after.membership, p.membership); assert.deepEqual(after.visual, p.visual);
  for (const key of ["position", "birthDate", "birthPlace", "nationality", "bats", "throws", "heightCm", "weightKg"] as const)
    if (p.profile[key] !== null) assert.equal(after.profile[key], p.profile[key]);
}
for (const key of ["hot", "countingRanking", "rateRanking", "records", "milestones", "careerStats", "directBvP"])
  assert.deepEqual(capabilities.data[key], oldCapabilities.data[key]);
const values = { "players/latest.json": projection.directory, "catalog/latest.json": catalog,
  "capabilities.json": capabilities, [`milestones/${season.season}/latest.json`]: milestones };
const files: Record<string, { bytes: number; sha256: string }> = {};
for (const [name, value] of Object.entries(values)) {
  const body = JSON.stringify(value), path = join(output, "data", "npb", name);
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, body);
  files[name] = { bytes: Buffer.byteLength(body), sha256: createHash("sha256").update(body).digest("hex") };
}
const fields = ["position", "birthDate", "birthPlace", "nationality", "heightCm", "weightKg"] as const;
const report = { result: "PASS", effectiveDate: directory.effectiveDate, players: directory.players.length,
  before: Object.fromEntries(fields.map(key => [key, before.players.filter(p => p.profile[key] !== null).length])),
  after: Object.fromEntries(fields.map(key => [key, catalog.players.filter(p => p.profile[key] !== null).length])),
  conflicts: projection.conflicts, milestones: { players: milestones.players.length, checkpoints: milestones.players.reduce((n, p) => n + p.checkpoints.length, 0), coverage: milestones.coverage },
  DBQueries: 0, canonicalWrites: 0, newSourceRequests: 0, generationMs: Math.round(performance.now() - started),
  idempotency: "PASS", existingGates: "unchanged", files };
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
