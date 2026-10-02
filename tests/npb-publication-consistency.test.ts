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
import { validateNpbPublication, validateNpbPublishedGameDates } from "../src/application/npb-publication-consistency";
import { npbHotPayloadSchema } from "../src/application/npb-hot-payload";
import { buildNpbRecords } from "../src/application/npb-records-payload";
import { npbCapabilitiesSchema } from "../src/domain/npb-product-contract";
import { readNpbPublication, writeNpbProfileProjections, npbPublicationHashes, verifyNpbPublicationHash, preserveNpbPublicStandings } from "../scripts/lib/npb-publication";
import { shiftGameDate } from "../src/domain/npb-game-index";
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
    milestones: buildNpbSeasonMilestones(season, catalog),
    gameManifest: { schemaVersion: 1, league: "NPB", from: date, to: "2026-10-07", effectiveDate: date, generatedAt: at },
    gameRecent: { schemaVersion: 1, league: "NPB", effectiveDate: date, generatedAt: at, games: [] },
    records: buildNpbRecords(season),
    standings: { schemaVersion: 1, league: "NPB", throughDate: date, effectiveDate: date, generatedAt: at,
      collectedAt: at, sourceUpdatedAt: null, sourceKey: "nf3", attribution: "Fixture",
      teams: Object.fromEntries(directory.teams.map(t => [t.id, { name: t.name, short: t.shortName }])),
      standings: catalog.teams.map(t => ({ date, season: 2026, league: "NPB", competitionGroup: t.division,
        teamId: t.teamId, rank: catalog.teams.filter(x => x.division === t.division).findIndex(x => x.teamId === t.teamId) + 1,
        wins: 0, losses: 0, ties: 0, gamesPlayed: 0, pct: 0, gamesBehindLeader: 0, streak: 0,
        sourceKey: "nf3", collectedAt: at, calculatedAt: at })) } };
}

async function stage(root: string, p: ReturnType<typeof family>) {
  await mkdir(join(root, "data/standings/npb"), { recursive: true });
  await writeFile(join(root, "data/standings/npb/latest.json"), JSON.stringify(p.standings));
  for (const [path, value] of Object.entries({ "players/latest.json": p.directory, "catalog/latest.json": p.catalog,
    "capabilities.json": p.capabilities, "season/2026/latest.json": p.season, "hot/latest.json": p.hot,
    "teams/season/2026/latest.json": p.teamSeason, "milestones/2026/latest.json": p.milestones,
    "games/manifest.json": p.gameManifest, "games/recent.json": p.gameRecent, "records/2026/latest.json": p.records,
    [`games/dates/${p.directory.effectiveDate}.json`]: { schemaVersion: 1, league: "NPB", date: p.directory.effectiveDate,
      generatedAt: p.gameManifest.generatedAt, coverage: "partial", games: [] } })) {
    const file = join(root, "data/npb", path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(value));
  }
  for (let date = p.gameManifest.from; date <= p.gameManifest.to; date = shiftGameDate(date, 1)) {
    const file = join(root, `data/npb/games/dates/${date}.json`); await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ schemaVersion: 1, league: "NPB", date,
      generatedAt: p.gameManifest.generatedAt, coverage: date === p.directory.effectiveDate ? "partial" : "unknown", games: [] }));
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
    const p = family(); p.directory.players[0]!.position = "C"; p.directory.players[0]!.playerType = "fielder";
    expect(() => validateNpbPublication(p)).toThrow(/Player position/);
  });
  it("rejects an enriched position with a stale Directory playerType", () => {
    const p = family();
    p.directory.players[0]!.position = "P"; p.catalog.players[0]!.profile.position = "P";
    expect(() => validateNpbPublication(p)).toThrow(/Player type/);
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
  it("rejects stale advertised field-specific curated counts", () => {
    for (const key of ["draftYear", "draftRound", "draftTeamId", "draftType", "joinedYear", "npbDebutYear", "rosterStatus", "schools"]) {
      const p = family(); p.capabilities.data[key]!.known = 1;
      expect(() => validateNpbPublication(p)).toThrow(/Capability/);
    }
  });
  it("rejects advertised capabilities with null counts and inconsistent metadata", () => {
    for (const key of ["draftType", "rosterStatus", "schools", "uniformNumber"]) {
      const p = family(); p.capabilities.data[key]!.known = null;
      expect(() => validateNpbPublication(p)).toThrow(new RegExp(`Capability ${key}`));
      for (const change of ["available", "status", "total", "reasons"] as const) {
        const bad = structuredClone(p), capability = bad.capabilities.data[key]!;
        if (change === "available") { capability.available = true; capability.status = "available"; }
        else if (change === "status") { capability.available = false; capability.status = "production_gate_pending"; }
        else if (change === "total") capability.total = 999;
        else capability.reasons = ["incorrect_projection_reason"];
        expect(() => npbCapabilitiesSchema.parse(bad.capabilities)).not.toThrow();
        expect(() => validateNpbPublication(bad)).toThrow(new RegExp(`Capability ${key}`));
      }
    }
  });
  it("accepts older releases that omit the additive field capabilities", () => {
    const p = family();
    for (const key of ["draftYear", "draftRound", "draftTeamId", "draftType", "joinedYear", "npbDebutYear", "rosterStatus"])
      delete p.capabilities.data[key];
    expect(() => validateNpbPublication(p)).not.toThrow();
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
    p.standings.effectiveDate = p.standings.throughDate = date;
    for (const row of p.standings.standings) row.date = date;
    p.gameManifest.effectiveDate = date; p.gameRecent.effectiveDate = date; p.records.effectiveDate = date;
    p.catalog = buildNpbCatalog(p.directory, reviewedMeasurements);
    p.capabilities = buildNpbCapabilities(p.catalog, p.season, p.hot.readiness);
    p.milestones = buildNpbSeasonMilestones(p.season, p.catalog);
    const result = validateNpbPublication(p);
    expect(result.directory.effectiveDate).toBe(date);
    expect(result.milestones!.effectiveDate).toBe(date);
    expect(result.capabilities.data.hot!.available).toBe(false);
  });
  it.each(["gameManifest", "gameRecent", "records"] as const)("rejects stale %s even after all profile projections advance", key => {
    const p = family(); p[key].effectiveDate = "2026-09-24";
    expect(() => validateNpbPublication(p)).toThrow(/Game surface effectiveDate/);
  });
  it("rejects stale same-date Recent generation and inconsistent Records gates", () => {
    const p = family(); p.gameRecent.generatedAt = "2026-09-25T01:00:00.000Z";
    expect(() => validateNpbPublication(p)).toThrow(/Game surface generation/);
    const q = family(); q.records.reasons = ["stale_reason"];
    expect(() => validateNpbPublication(q)).toThrow(/Records projection/);
  });
  it("rejects missing or reordered categories even while the Records gate is closed", () => {
    const p = family(); p.records.categories = [];
    expect(() => validateNpbPublication(p)).toThrow(/Records projection/);
    const q = family(); q.records.categories.reverse();
    expect(() => validateNpbPublication(q)).toThrow(/Records projection/);
  });
  it("compares complete ready Records including tied membership, order, values and ranks", () => {
    const p = family(), id = "00000000-0000-4000-8000-000000000999";
    p.directory.players.push({ ...p.directory.players[0]!, playerId: id, displayName: "別選手" });
    p.season.players.push({ ...structuredClone(p.season.players[0]!), playerId: id, displayName: "別選手" });
    p.season.coverage = { status: "complete", summary: { dates: 1, complete: 1, noGames: 0, partial: 0, unknown: 0, failed: 0 } };
    p.season.readiness = { status: "ready", counting: "ready", rateQualifier: "verified", reasons: [] };
    p.teamSeason.coverage = p.season.coverage;
    p.catalog = buildNpbCatalog(p.directory, reviewedMeasurements);
    p.capabilities = buildNpbCapabilities(p.catalog, p.season, p.hot.readiness);
    p.milestones = buildNpbSeasonMilestones(p.season, p.catalog);
    p.records = buildNpbRecords(p.season);
    expect(p.records.categories[1]!.rows.map(r => r.rank)).toEqual([1, 1]);
    expect(() => validateNpbPublication(p)).not.toThrow();
    for (const damage of ["missing", "rank", "value", "order"] as const) {
      const bad = structuredClone(p), rows = bad.records.categories[1]!.rows;
      if (damage === "missing") rows.pop();
      else if (damage === "order") rows.reverse();
      else if (damage === "rank") rows[0]!.rank = 2;
      else rows[0]!.value++;
      expect(() => validateNpbPublication(bad)).toThrow(/Records projection/);
    }
  });
  it("requires the effective day's schedule to propagate to the manifest generation", () => {
    const p = validateNpbPublication(family());
    const day = { schemaVersion: 1, league: "NPB", date: p.directory.effectiveDate,
      generatedAt: p.gameManifest!.generatedAt, coverage: "partial", games: [] };
    expect(() => validateNpbPublishedGameDates(p, [day])).not.toThrow();
    expect(() => validateNpbPublishedGameDates(p, [])).toThrow(/published Game dates/);
    expect(() => validateNpbPublishedGameDates(p, [{ ...day, generatedAt: "2026-09-25T01:00:00.000Z" }])).toThrow(/dated Game generation/);
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
  it("binds regenerated and deliberately preserved Team Season to the exact staged artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "npb-hash-publication-"));
    try {
      const p = family(); await stage(root, p);
      const hashes = await npbPublicationHashes(root), path = "teams/season/2026/latest.json";
      const old = await readFile(join(root, "data/npb", path));
      expect(() => verifyNpbPublicationHash(hashes, path, old)).not.toThrow();
      const refreshed = Buffer.from(JSON.stringify({ ...p.teamSeason, generatedAt: "2026-10-01T02:00:00.000Z" }));
      expect(() => verifyNpbPublicationHash(hashes, path, refreshed)).toThrow(/staged artifact/);
      await writeFile(join(root, "data/npb", path), refreshed);
      const next = await npbPublicationHashes(root);
      expect(() => verifyNpbPublicationHash(next, path, refreshed)).not.toThrow();
      expect(() => verifyNpbPublicationHash(next, path, old)).toThrow(/staged artifact/);
      for (const key of ["season/2026/latest.json", "hot/latest.json", "records/2026/latest.json", "games/dates/2026-09-25.json"])
        expect(hashes[key]).toMatch(/^[a-f0-9]{64}$/);
      const standings = Buffer.from(JSON.stringify(p.standings));
      expect(() => verifyNpbPublicationHash(hashes, "standings/npb/latest.json", standings)).not.toThrow();
      const correction = structuredClone(p.standings); correction.standings[0]!.wins = 1; correction.standings[0]!.gamesPlayed = 1;
      expect(() => verifyNpbPublicationHash(hashes, "standings/npb/latest.json", Buffer.from(JSON.stringify(correction)))).toThrow(/staged artifact/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("rejects a standings date ahead of the coordinated family", () => {
    const p = family(); p.standings.effectiveDate = p.standings.throughDate = "2026-09-26";
    for (const row of p.standings.standings) row.date = "2026-09-26";
    expect(() => validateNpbPublication(p)).toThrow(/Standings effectiveDate/);
  });
  it("preserves the published standings bytes rather than a newer database snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "npb-public-standing-"));
    try {
      const p = family(); await stage(root, p); const body = JSON.stringify(p.standings, null, 2);
      const result = await preserveNpbPublicStandings(root, async () => new Response(body));
      expect(result).toEqual({ effectiveDate: p.directory.effectiveDate, canonicalWrites: 0 });
      expect(await readFile(join(root, "data/standings/npb/latest.json"), "utf8")).toBe(body);
      expect((await readNpbPublication(root)).standings!.effectiveDate).toBe(p.directory.effectiveDate);
      for (const response of [new Response(null, { status: 503 }), Response.json({ invalid: true })])
        await expect(preserveNpbPublicStandings(root, async () => response)).rejects.toThrow();
      expect(await readFile(join(root, "data/standings/npb/latest.json"), "utf8")).toBe(body);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

type Workflow = { jobs: Record<string, { steps: { run?: string; uses?: string; if?: string }[] }> };
const workflow = (name: string) => parse(readFileSync(`.github/workflows/${name}.yml`, "utf8")) as Workflow;
describe("all Pages publication entry points", () => {
  it("profile-only publication skips every DB path and retains the coordinated artifact checks", () => {
    const steps = workflow("npb-player-directory-publish").jobs.stage!.steps;
    for (const script of ["import-npb-player-master-v2.ts", "generate-npb-player-directory.ts", "publish:npb:remote"]) {
      expect(steps.find(s => s.run?.includes(script))?.if).toContain("inputs.profile_projection_only != true");
    }
    expect(steps.find(s => s.run?.includes("stage-npb-profile-only-directory.ts"))?.if).toBe("inputs.profile_projection_only == true");
    expect(steps.some(s => s.run?.includes("refresh-npb-profile-projections.ts"))).toBe(true);
    expect(steps.some(s => s.run?.includes("verify-npb-publication.ts"))).toBe(true);
  });
  it("MLB-only publication preserves the public NPB standings before its dependent family", () => {
    const run = workflow("mlb-historical-publish").jobs.stage!.steps.map(s => s.run ?? "").join("\n");
    expect(run).not.toContain("publish:npb:remote");
    expect(run.indexOf("preserve-published-npb-standings.ts")).toBeLessThan(run.indexOf("preserve-published-npb-hot.ts"));
    expect(run.indexOf("preserve-published-npb-standings.ts")).toBeLessThan(run.indexOf("verify-npb-publication.ts"));
  });
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
  it.each(["npb-player-directory-publish", "npb-hot-publish", "npb-season-publish", "daily-collector",
    "npb-eod-watcher", "mlb-historical-publish"])("%s passes staged hashes to the deploy verifier", name => {
    const w = parse(readFileSync(`.github/workflows/${name}.yml`, "utf8")) as {
      jobs: Record<string, { outputs?: Record<string, string>; steps: { id?: string; run?: string; env?: Record<string, string> }[] }> };
    const stageName = name === "daily-collector" ? "collect" : name === "npb-eod-watcher" ? "watch" : "stage";
    expect(w.jobs[stageName]!.steps.find(s => s.run?.includes("verify-npb-publication.ts"))?.id).toBe("publication");
    expect(w.jobs[stageName]!.outputs?.projection_hashes).toBe("${{ steps.publication.outputs.projection_hashes }}");
    expect(w.jobs.deploy!.steps.find(s => s.run?.includes("verify-published-npb-player-directory.ts"))?.env?.EXPECTED_PROJECTION_HASHES)
      .toBe(`\${{ needs.${stageName}.outputs.projection_hashes }}`);
    const steps = w.jobs.deploy!.steps;
    const check = steps.findIndex(s => s.run?.includes("verify-published-npb-player-directory.ts"));
    expect(check).toBeGreaterThan(steps.findIndex(s => s.run === "npm ci"));
    for (const operation of ["--action=mark-published", "send-eod-notifications.ts"])
      if (steps.some(s => s.run?.includes(operation)))
        expect(steps.findIndex(s => s.run?.includes(operation))).toBeGreaterThan(check);
  });
});
