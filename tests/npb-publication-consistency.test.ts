import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { npbTeams } from "../src/data/npb-nf3";
import supplement from "../src/data/npb-reviewed-profile-supplement.json";
import { reviewedMeasurements } from "../src/data/npb-reviewed-measurements";
import { buildNpbCatalog, buildNpbCapabilities } from "../src/application/npb-product-payload";
import { buildNpbSeasonMilestones } from "../src/application/npb-season-milestones";
import { npbSeasonPayloadSchema, seasonBattingKeys } from "../src/application/npb-season-payload";
import { validateNpbPublication } from "../src/application/npb-publication-consistency";
import { npbHotPayloadSchema } from "../src/application/npb-hot-payload";
import { readNpbPublication, writeNpbProfileProjections } from "../scripts/lib/npb-publication";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import hotFixture from "./fixtures/npb-hot-ready.json";

function family() {
  const at = "2026-09-26T00:00:00.000Z", date = "2026-09-25", playerId = supplement.players[2]!.playerId;
  const directory: NpbPlayerDirectory = { schemaVersion: 2, league: "NPB", effectiveDate: date, generatedAt: at,
    teams: npbTeams.map(t => ({ id: t.id, name: t.name, shortName: t.short })),
    players: [{ playerId, displayName: "マルティネス", teamId: "npb:team:fighters", position: null, playerType: null,
      birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
      battingAvailable: true, pitchingAvailable: false, recentAvailable: true }] };
  const coverage = { status: "partial", summary: { dates: 1, complete: 0, noGames: 0, partial: 1, unknown: 0, failed: 0 } };
  const season = npbSeasonPayloadSchema.parse({ schemaVersion: 1, league: "NPB", season: 2026,
    effectiveDate: date, generatedAt: at, period: { from: date, to: date }, coverage,
    readiness: { status: "not_ready", reasons: ["season_coverage_not_complete"], counting: "not_ready", rateQualifier: "verified" },
    players: [{ playerId, displayName: "マルティネス", teamId: "npb:team:fighters", pitching: null,
      batting: { factCount: 1, metrics: Object.fromEntries(seasonBattingKeys.map(k => [k,
        { value: k === "H" ? 50 : 0, status: "complete", observedFacts: 1, factCount: 1 }])) } }],
    rankings: { batting: [], pitching: [] } });
  const hot = { ...structuredClone(hotFixture), batting: [], starters: [], relievers: [], readiness: {
    ...hotFixture.readiness, status: "not_ready" as const, scheduledProductionEvidence: false,
    reasons: ["scheduled_production_evidence_pending"] } };
  const catalog = buildNpbCatalog(directory, reviewedMeasurements);
  return { directory, catalog, season, hot, capabilities: buildNpbCapabilities(catalog, season, hot.readiness),
    teamSeason: { schemaVersion: 1, league: "NPB", season: 2026, competition: "regular", effectiveDate: date, generatedAt: at,
      period: season.period, scope: "stored_final_games", coverage, teams: [] },
    milestones: buildNpbSeasonMilestones(season, catalog) };
}

async function stage(root: string, p: ReturnType<typeof family>) {
  for (const [path, value] of Object.entries({ "players/latest.json": p.directory, "catalog/latest.json": p.catalog,
    "capabilities.json": p.capabilities, "season/2026/latest.json": p.season, "hot/latest.json": p.hot,
    "teams/season/2026/latest.json": p.teamSeason, "milestones/2026/latest.json": p.milestones })) {
    const file = join(root, "data/npb", path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(value));
  }
}
const run = (script: string, ...args: string[]) => execFileSync(process.execPath,
  ["node_modules/tsx/dist/cli.mjs", `scripts/${script}.ts`, ...args], { encoding: "utf8", stdio: "pipe" });

describe("coordinated NPB publication", () => {
  it("validates the released family without changing Facts/Coverage/Gates", () => {
    const p = family(), before = JSON.stringify(p);
    expect(validateNpbPublication(p).directory).toEqual(p.directory); expect(JSON.stringify(p)).toBe(before);
  });
  it("rejects same-date Directory-only enrichment even when timestamps match", () => {
    const p = family(); p.directory.players[0]!.position = "C";
    expect(() => validateNpbPublication(p)).toThrow(/Player position/);
  });
  it("rejects different generations on the same date even without a field change", () => {
    const p = family(); p.directory.generatedAt = "2026-09-26T01:00:00.000Z";
    expect(() => validateNpbPublication(p)).toThrow(/generation/);
  });
  it("rejects date advancement against preserved Season and HOT", () => {
    const p = family(); p.directory.effectiveDate = "2026-09-26";
    expect(() => validateNpbPublication(p)).toThrow(/coordinated Season/);
  });
  it("rejects stale Capability counts and altered gates", () => {
    const p = family(); p.capabilities.data.position!.known = 1;
    expect(() => validateNpbPublication(p)).toThrow(/Capability position/);
    const q = family(); q.capabilities.data.hot!.reasons = [];
    expect(() => validateNpbPublication(q)).toThrow(/Capability hot/);
  });
  it("rejects missing/damaged advertised Milestones and changed counts", () => {
    const p = family(), { milestones: omitted, ...without } = p;
    expect(omitted.players).toHaveLength(1);
    expect(() => validateNpbPublication(without)).toThrow(/advertised Milestones/);
    p.milestones.players[0]!.checkpoints[0]!.count++;
    expect(() => validateNpbPublication(p)).toThrow();
  });
  it("permits a coherent legacy family without the additive capability", () => {
    const { milestones: omitted, ...p } = family(); expect(omitted.players).toHaveLength(1);
    delete p.capabilities.data.seasonMilestones;
    expect(validateNpbPublication(p).milestones).toBeUndefined();
  });
  it("rejects canonical identity/affiliation divergence", () => {
    const p = family(); p.catalog.players[0]!.membership.teamId = "npb:team:tigers";
    expect(() => validateNpbPublication(p)).toThrow(/Player context/);
    const q = family(); q.catalog.players[0]!.playerId = "00000000-0000-4000-8000-000000000999";
    expect(() => validateNpbPublication(q)).toThrow(/Player IDs/);
  });
  it("binds regenerated Milestones to the shared Directory/Catalog generation", () => {
    const p = family(); p.season.generatedAt = "2026-09-25T23:00:00.000Z";
    expect(buildNpbSeasonMilestones(p.season, p.catalog).generatedAt).toBe(p.directory.generatedAt);
    expect(validateNpbPublication(p).season.generatedAt).toBe(p.season.generatedAt);
  });
  it("requires regenerated Capabilities when HOT readiness changes on the same date", () => {
    const p = { ...family(), hot: npbHotPayloadSchema.parse(hotFixture) };
    expect(() => validateNpbPublication(p)).toThrow(/Capability hot/);
    p.capabilities = buildNpbCapabilities(p.catalog, p.season, p.hot.readiness);
    expect(validateNpbPublication(p).hot.readiness.status).toBe("ready");
    expect(p.season.readiness.status).toBe("not_ready");
  });
  it("accepts date advancement only after the whole dependent family is regenerated", () => {
    const p = family(), date = "2026-09-26";
    p.hot.effectiveDate = date;
    p.hot.period = { ...p.hot.period, from: "2026-09-20", to: date };
    expect(() => validateNpbPublication(p)).toThrow(/effectiveDate/);
    p.directory.effectiveDate = date;
    p.directory.generatedAt = "2026-09-27T00:00:00.000Z";
    p.season.effectiveDate = date; p.season.period.to = date;
    p.teamSeason.effectiveDate = date; p.teamSeason.period.to = date;
    p.catalog = buildNpbCatalog(p.directory, reviewedMeasurements);
    p.capabilities = buildNpbCapabilities(p.catalog, p.season, p.hot.readiness);
    p.milestones = buildNpbSeasonMilestones(p.season, p.catalog);
    const result = validateNpbPublication(p);
    expect(result.directory.effectiveDate).toBe(date);
    expect(result.milestones!.effectiveDate).toBe(date);
    expect(result.capabilities.data.hot!.available).toBe(false);
  });
  it("runs the Directory publication refresh end-to-end, preserving base payloads and rerun values", async () => {
    const root = await mkdtemp(join(tmpdir(), "npb-profile-publication-"));
    try {
      const p = family(); await stage(root, p);
      const candidate = { ...p.directory, generatedAt: "2026-10-01T02:00:00.000Z" }, input = join(root, "candidate.json");
      await writeFile(input, JSON.stringify(candidate));
      const immutablePaths = ["season/2026/latest.json", "hot/latest.json", "teams/season/2026/latest.json"];
      const before = await Promise.all(immutablePaths.map(path => readFile(join(root, "data/npb", path), "utf8")));
      expect(run("refresh-npb-profile-projections", input, root)).toContain('"gates":"preserved"');
      const result = await readNpbPublication(root);
      expect(result.directory.players[0]!.position).toBe("C");
      expect(result.catalog.players[0]!.profile.heightCm).toBe(190);
      expect(result.capabilities.data.heightCm!.known).toBe(1);
      expect(result.milestones!.generatedAt).toBe(candidate.generatedAt);
      expect(result.hot.readiness).toEqual(p.hot.readiness); expect(result.season.coverage).toEqual(p.season.coverage);
      expect(await Promise.all(immutablePaths.map(path => readFile(join(root, "data/npb", path), "utf8")))).toEqual(before);
      expect(run("verify-npb-publication", root)).toContain('"publication":"consistent"');
      run("refresh-npb-profile-projections", input, root);
      expect(await readNpbPublication(root)).toEqual(result);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("fails closed before writing when a newly read Directory is ahead of the preserved family", async () => {
    const root = await mkdtemp(join(tmpdir(), "npb-profile-publication-"));
    try {
      const p = family(); await stage(root, p); const input = join(root, "candidate.json");
      await writeFile(input, JSON.stringify({ ...p.directory, effectiveDate: "2026-09-26" }));
      expect(() => run("refresh-npb-profile-projections", input, root)).toThrow();
      expect(await readNpbPublication(root)).toEqual(validateNpbPublication(p));
      await expect(writeNpbProfileProjections(root, { ...p, milestones: undefined })).rejects.toThrow();
      expect(await readNpbPublication(root)).toEqual(validateNpbPublication(p));
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

type Workflow = { jobs: Record<string, { steps: { run?: string; uses?: string; if?: string }[] }> };
const workflow = (name: string) => parse(readFileSync(`.github/workflows/${name}.yml`, "utf8")) as Workflow;
describe("all Pages publication entry points", () => {
  it.each(["npb-player-directory-publish", "npb-season-publish", "npb-hot-publish", "daily-collector",
    "npb-eod-watcher", "mlb-historical-publish"])("%s validates the final family before uploading one artifact", name => {
    const steps = Object.values(workflow(name).jobs).flatMap(j => j.steps);
    const upload = steps.findIndex(s => s.uses?.startsWith("actions/upload-pages-artifact"));
    const guard = steps.findIndex(s => s.run?.includes("verify-npb-publication.ts dist"));
    expect(guard).toBeGreaterThan(-1); expect(upload).toBeGreaterThan(guard);
    expect(steps[guard]!.if).toBe(steps[upload]!.if);
    expect(steps.slice(guard + 1, upload).some(s => s.run !== undefined)).toBe(false);
  });
  it("Directory publisher preserves the baseline and regenerates dependencies before validation", () => {
    const run = workflow("npb-player-directory-publish").jobs.stage!.steps.map(s => s.run ?? "").join("\n");
    expect(run.indexOf("preserve-published-npb-player-directory.ts")).toBeLessThan(run.indexOf("refresh-npb-profile-projections.ts"));
    expect(run.indexOf("preserve-published-npb-game-surface.ts")).toBeLessThan(run.indexOf("refresh-npb-profile-projections.ts"));
    expect(run.indexOf("refresh-npb-profile-projections.ts")).toBeLessThan(run.indexOf("verify-npb-publication.ts"));
    expect(run).not.toContain("cp .data/publish/data/npb/players/latest.json");
  });
  it("HOT publisher regenerates the dated family from the actual HOT date before staging", () => {
    const steps = workflow("npb-hot-publish").jobs.stage!.steps;
    const hot = steps.findIndex(s => s.run?.includes("publish-npb-hot.ts"));
    const projection = steps.findIndex(s => s.run?.includes("generate-npb-game-surface.ts"));
    const build = steps.findIndex(s => s.run?.includes("npm run build"));
    expect(projection).toBeGreaterThan(hot); expect(build).toBeGreaterThan(projection);
    const generate = steps[projection]!.run!;
    expect(generate).toContain(".data/publish/data/npb/hot/latest.json').effectiveDate");
    for (const script of ["generate-npb-season.ts", "generate-npb-player-directory.ts", "generate-npb-game-surface.ts"])
      expect(generate.split("\n").find(line => line.includes(script))).toContain('--date="$date"');
    const stage = steps[build]!.run!;
    expect(stage).toContain("cp -R .data/publish/data dist/");
    expect(stage).not.toContain("preserve-published-npb");
    expect(stage).toContain("preserve-mlb-historical.ts");
    expect(workflow("npb-hot-publish").jobs.deploy!.steps.some(s => s.run?.includes("verify-published-npb-player-directory.ts"))).toBe(true);
  });
});
