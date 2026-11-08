import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { join, resolve, sep } from "node:path";
import { z } from "zod";
import { projectNpbFreeProfiles } from "../src/application/npb-profile-projection";
import { validateNpbPublication, type NpbPublicationInputs } from "../src/application/npb-publication-consistency";
import { openDataClient } from "../src/data/database";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { readNpbTeamSeason } from "../src/data/npb-team-season-repository";
import { npbCatalogSchema, npbTeamSeasonSchema, type NpbTeamSeason } from "../src/domain/npb-product-contract";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { npbSeasonPayloadSchema } from "../src/application/npb-season-payload";
import { npbPublicationHashes } from "./lib/npb-publication";

const paths = { directory: "players/latest.json", catalog: "catalog/latest.json", capabilities: "capabilities.json",
  season: "season/2026/latest.json", hot: "hot/latest.json", teamSeason: "teams/season/2026/latest.json",
  milestones: "milestones/2026/latest.json" } as const;
const names = { catalog: "catalog.json", teamSeason: "team-season.json", report: "report.json" };
const base = "https://tomoya41.github.io/baseball-notes/data/npb/";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown) => JSON.stringify(value);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const pair = z.strictObject({ catalog: hashSchema, teamSeason: hashSchema });
const reportSchema = z.strictObject({ result: z.literal("PASS"), effectiveDate: z.iso.date(), generatedAt: z.iso.datetime(),
  previousTeamGeneratedAt: z.iso.datetime(), teams: z.literal(12), players: z.number().int().positive(),
  coverage: z.string(), backupSha256: hashSchema, publishedHashes: pair, stagedHashes: pair });

function sameTeamSnapshot(a: NpbTeamSeason, b: NpbTeamSeason) {
  return isDeepStrictEqual({ ...a, generatedAt: b.generatedAt }, b);
}

async function stage(database: string, destination: string, backupSha256: string) {
  const output = resolve(destination);
  if (!output.startsWith(resolve(".data") + sep)) throw Error("Repair staging must be inside .data");
  hashSchema.parse(backupSha256);
  await access(database);
  const values = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
    const response = await fetch(base + path, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw Error("Repair input HTTP " + response.status + ": " + path);
    return [key, await response.text()] as const;
  }));
  const bodies = Object.fromEntries(values);
  const published = Object.fromEntries(values.map(([key, body]) => [key, JSON.parse(body) as unknown])) as NpbPublicationInputs;
  const directory = npbPlayerDirectorySchema.parse(published.directory);
  const priorCatalog = npbCatalogSchema.parse(published.catalog), priorTeam = npbTeamSeasonSchema.parse(published.teamSeason);
  const season = npbSeasonPayloadSchema.parse(published.season);
  if (priorTeam.generatedAt === priorCatalog.generatedAt) throw Error("No Catalog/Team Season generation mismatch");
  const profiles = projectNpbFreeProfiles(directory, priorCatalog);
  if (!isDeepStrictEqual(profiles.directory, directory) || !isDeepStrictEqual(profiles.catalog, priorCatalog))
    throw Error("Profile projection differs from the published Directory or Catalog");
  const client = openDataClient("file:" + resolve(database));
  try {
    await client.execute("PRAGMA query_only=ON");
    const coverage = await new NpbPeriodCoverageRepository(client).findPeriodCoverage({ ...season.period, timeZone: "Asia/Tokyo" });
    const teamSeason = await readNpbTeamSeason(client, profiles.catalog, coverage);
    if (!sameTeamSnapshot(teamSeason, priorTeam))
      throw Error("Replayed Team Season rows, period or Coverage differ from the published projection");
    validateNpbPublication({ ...published, catalog: profiles.catalog, teamSeason });
    const catalogBody = json(profiles.catalog), teamBody = json(teamSeason);
    const report = reportSchema.parse({ result: "PASS", effectiveDate: directory.effectiveDate, generatedAt: directory.generatedAt,
      previousTeamGeneratedAt: priorTeam.generatedAt, teams: teamSeason.teams.length, players: directory.players.length, coverage: teamSeason.coverage.status,
      backupSha256, publishedHashes: { catalog: hash(bodies.catalog!), teamSeason: hash(bodies.teamSeason!) },
      stagedHashes: { catalog: hash(catalogBody), teamSeason: hash(teamBody) } });
    await mkdir(output);
    await Promise.all([writeFile(join(output, names.catalog), catalogBody), writeFile(join(output, names.teamSeason), teamBody)]);
    await writeFile(join(output, names.report), json(report));
    console.log(json(report));
  } finally { client.close(); }
}

async function apply(bundle: string, root: string) {
  const report = reportSchema.parse(JSON.parse(await readFile(join(bundle, names.report), "utf8")));
  const [catalog, teamSeason] = await Promise.all([names.catalog, names.teamSeason].map(name => readFile(join(bundle, name), "utf8")));
  const at = (path: string) => join(root, "data/npb", path);
  const [priorCatalog, priorTeam] = await Promise.all([paths.catalog, paths.teamSeason].map(path => readFile(at(path), "utf8")));
  if (hash(catalog!) !== report.stagedHashes.catalog || hash(teamSeason!) !== report.stagedHashes.teamSeason ||
      hash(priorCatalog!) !== report.publishedHashes.catalog || hash(priorTeam!) !== report.publishedHashes.teamSeason)
    throw Error("Team repair bundle or published input hash differs; re-stage before publication");
  const nextCatalog = npbCatalogSchema.parse(JSON.parse(catalog!)), nextTeam = npbTeamSeasonSchema.parse(JSON.parse(teamSeason!));
  const oldTeam = npbTeamSeasonSchema.parse(JSON.parse(priorTeam!));
  if (nextCatalog.effectiveDate !== report.effectiveDate || nextCatalog.generatedAt !== report.generatedAt ||
      oldTeam.generatedAt !== report.previousTeamGeneratedAt || oldTeam.generatedAt === nextTeam.generatedAt ||
      !isDeepStrictEqual(nextCatalog, npbCatalogSchema.parse(JSON.parse(priorCatalog!))) ||
      !sameTeamSnapshot(nextTeam, oldTeam))
    throw Error("Team repair does not preserve the published profile or statistical content");
  await npbPublicationHashes(root, { catalog: nextCatalog, teamSeason: nextTeam });
  await Promise.all([writeFile(at(paths.catalog), catalog!), writeFile(at(paths.teamSeason), teamSeason!)]);
  await npbPublicationHashes(root);
  console.log(json(report));
}

const [mode, first, second, backupSha256] = process.argv.slice(2);
if (mode === "stage" && first && second && backupSha256) await stage(first, second, backupSha256);
else if (mode === "apply" && first && second) await apply(first, second);
else throw Error("Usage: npb-team-generation-repair.ts stage <scratch.db> <new .data directory> <backup sha256> | apply <bundle> <site staging root>");
