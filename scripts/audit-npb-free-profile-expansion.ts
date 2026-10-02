import { readFile, writeFile } from "node:fs/promises";
import { npbCatalogSchema } from "../src/domain/npb-product-contract";
import registry from "../src/data/npb-free-profile-registry.json";
import wikipedia from "../src/data/npb-wikipedia-profile-registry.json";
import curated from "../src/data/npb-curated-profile-registry.json";
import assisted from "../src/data/npb-codex-assisted-profile-registry.json";

const [beforePath, afterPath, output] = process.argv.slice(2);
if (!beforePath || !afterPath || !output) throw Error("Pass before-catalog after-catalog output-report");
const [before, after] = await Promise.all([beforePath, afterPath].map(async p => npbCatalogSchema.parse(JSON.parse(await readFile(p, "utf8")))));
const fields = ["position", "knownPositions", "bats", "throws", "birthDate", "birthPlace", "originPlace", "nationality", "heightCm", "weightKg",
  "draftYear", "draftRound", "draftTeamId", "draftType", "joinedYear", "debutYear", "npbDebutYear", "schools", "amateurHistory", "affiliations", "identityLinked"] as const;
const count = (rows: typeof before.players, field: typeof fields[number]) => rows.filter(p => {
  const v = p.profile[field]; return Array.isArray(v) ? v.length > 0 : v != null && v !== false;
}).length;
const report = { players: after.players.length, effectiveDate: after.effectiveDate,
  counts: Object.fromEntries(fields.map(field => [field, { before: count(before.players, field), after: count(after.players, field) }])),
  currentTeam: { before: before.players.filter(p => p.membership.teamId !== null).length, after: after.players.filter(p => p.membership.teamId !== null).length, scope: "latest_stored_affiliation_not_current_roster" },
  uniformNumber: { before: before.players.filter(p => p.membership.uniformNumber !== null).length, after: after.players.filter(p => p.membership.uniformNumber !== null).length },
  registrationClass: { before: 0, after: after.players.filter(p => p.membership.registrationClass != null).length },
  schoolAny: { before: before.players.filter(p => !!p.profile.schools?.length || !!p.profile.amateurHistory?.length).length,
    after: after.players.filter(p => !!p.profile.schools?.length || !!p.profile.amateurHistory?.length).length },
  sourceVerifiedEntries: registry.entries.length + wikipedia.entries.length + curated.entries.length + assisted.entries.length,
  automatedEntries: curated.entries.filter(e => e.verificationMethod === "automated").length,
  codexAssistedEntries: assisted.entries.length, humanReviewedEntries: 0, canonicalWrites: 0,
  catalogBytes: Buffer.byteLength(JSON.stringify(after)) };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report));
