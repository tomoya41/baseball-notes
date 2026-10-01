import { describe, expect, it } from "vitest";
import source from "./fixtures/wikidata-npb-profile-supplement.json";
import labels from "./fixtures/wikidata-npb-profile-labels.json";
import reviewed from "../src/data/npb-reviewed-profile-supplement.json";
import { reviewedProfileBridges } from "../src/data/npb-reviewed-profile-bridges";
import { reviewedMeasurements } from "../src/data/npb-reviewed-measurements";
import { readNpbProfileSupplements } from "../src/infrastructure/providers/wikidata-npb-profile-supplement";
import { supplementNpbDirectory, supplementNpbMeasurements } from "../src/application/npb-profile-supplement";
import { buildNpbCatalog, buildNpbCapabilities } from "../src/application/npb-product-payload";
import { buildNpbSeasonMilestones } from "../src/application/npb-season-milestones";
import { npbSeasonMilestonesSchema } from "../src/domain/npb-season-milestones";
import { npbTeams } from "../src/data/npb-nf3";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import type { NpbSeasonPayload } from "../src/application/npb-season-payload";
import { StaticNpbProductRepository } from "../src/infrastructure/providers/static-npb-product-repository";

const id = reviewed.players[2]!.playerId, at = reviewed.observedAt;
const directory: NpbPlayerDirectory = { schemaVersion: 2, league: "NPB", effectiveDate: "2026-09-30", generatedAt: at,
  teams: npbTeams.map(t => ({ id: t.id, name: t.name, shortName: t.short })),
  players: [{ playerId: id, displayName: "マルティネス", teamId: "npb:team:fighters", position: null, playerType: null,
    birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
    battingAvailable: true, pitchingAvailable: false, recentAvailable: true }] };
const metric = (value: number | null, status: "complete" | "partial" | "unavailable" = "complete") =>
  ({ value, status, observedFacts: status === "complete" ? 2 : 1, factCount: 2 });
export function sampleMilestoneSeason() {
  return { schemaVersion: 1, league: "NPB", season: 2026, effectiveDate: directory.effectiveDate, generatedAt: at,
    period: { from: "2026-03-27", to: directory.effectiveDate },
    coverage: { status: "partial", summary: { dates: 2, complete: 1, noGames: 0, partial: 1, unknown: 0, failed: 0 } },
    readiness: { status: "not_ready", reasons: ["season_coverage_not_complete"], counting: "not_ready", rateQualifier: "verified" },
    players: [{ playerId: id, displayName: "マルティネス", teamId: "npb:team:fighters",
      batting: { factCount: 2, metrics: { H: metric(50), HR: metric(0), RBI: metric(null, "unavailable"), SB: metric(1, "partial") } },
      pitching: null }], rankings: { batting: [], pitching: [] } } as unknown as NpbSeasonPayload;
}
describe("reviewed CC0 profile supplement", () => {
  it("reproduces all eight reviewed external-ID results from the source fixture", () => {
    expect(readNpbProfileSupplements(source, labels, reviewedProfileBridges, at)).toEqual(reviewed);
  });
  it("preserves year-only DOB, missing measurements and absent position as unknown", () => {
    expect(reviewed.players[0]).toMatchObject({ birthDate: null, position: "P", heightCm: null });
    expect(reviewed.players[1]).toMatchObject({ position: null, heightCm: null, weightKg: null });
  });
  it("uses an exact external-ID bridge even when display names differ", () => {
    const r = supplementNpbDirectory(directory, reviewed).directory.players[0]!;
    expect(r.displayName).toBe("マルティネス"); expect(r.position).toBe("C"); expect(r.birthDate).toBe("1996-05-28");
    expect(r.playerType).toBe("fielder");
    expect(r.teamId).toBe(directory.players[0]!.teamId); expect(r.pitchingAvailable).toBe(false);
  });
  it("derives playerType from an accepted position without inventing Fact availability", () => {
    const player = reviewed.players[0]!;
    const input = { ...directory, players: [{ ...directory.players[0]!, playerId: player.playerId,
      battingAvailable: false, pitchingAvailable: false, recentAvailable: false }] };
    const result = supplementNpbDirectory(input, reviewed).directory;
    expect(result.players[0]).toMatchObject({ position: "P", playerType: "pitcher",
      battingAvailable: false, pitchingAvailable: false, recentAvailable: false });
    expect(supplementNpbDirectory(result, reviewed).directory).toEqual(result);
    const unknown = { ...reviewed, players: [{ ...player, position: null }] };
    expect(supplementNpbDirectory(input, unknown).directory.players[0]!.playerType).toBeNull();
    const conflict = { ...input, players: [{ ...input.players[0]!, position: "C" as const, playerType: "fielder" as const }] };
    expect(supplementNpbDirectory(conflict, reviewed).directory.players[0]).toMatchObject({ position: "C", playerType: "fielder" });
  });
  it("rejects a name-only match and a mismatched bridge", () => {
    const raw = structuredClone(source); Reflect.deleteProperty(raw.entities.Q52083715.claims, "P4260");
    expect(() => readNpbProfileSupplements(raw, labels, reviewedProfileBridges, at)).toThrow(/identity/);
    expect(() => readNpbProfileSupplements(source, labels, [{ ...reviewedProfileBridges[0]!, npbId: "13415155" }], at)).toThrow(/identity/);
  });
  it("rejects duplicate canonical/external mappings and duplicate source IDs", () => {
    expect(() => readNpbProfileSupplements(source, labels, [reviewedProfileBridges[0]!, reviewedProfileBridges[0]!], at)).toThrow(/Ambiguous/);
    const raw = structuredClone(source);
    raw.entities.Q130726841.claims.P4260 = structuredClone(raw.entities.Q52083715.claims.P4260);
    expect(() => readNpbProfileSupplements(raw, labels, reviewedProfileBridges, at)).toThrow(/identity/);
  });
  it("honors preferred/deprecated claims and rejects unknown measurement units", () => {
    const raw = structuredClone(source);
    const claim = raw.entities.Q52083715.claims.P2048![0]!;
    raw.entities.Q52083715.claims.P2048 = [{ ...claim, rank: "preferred" }, { ...claim, rank: "deprecated" }];
    expect(readNpbProfileSupplements(raw, labels, reviewedProfileBridges, at).players[2]!.heightCm).toBe(190);
    claim.mainsnak.datavalue!.value.unit = "unknown";
    raw.entities.Q52083715.claims.P2048 = [claim];
    expect(readNpbProfileSupplements(raw, labels, reviewedProfileBridges, at).players[2]!.heightCm).toBeNull();
  });
  it("does not overwrite known profiles, records conflicts and is idempotent", () => {
    const existing = structuredClone(directory); existing.players[0]!.birthDate = "1996-05-29";
    const a = supplementNpbDirectory(existing, reviewed);
    expect(a.conflicts).toEqual([{ playerId: id, field: "birthDate" }]); expect(a.directory.players[0]!.birthDate).toBe("1996-05-29");
    expect(supplementNpbDirectory(a.directory, reviewed)).toEqual(a);
    expect(existing.players[0]!.position).toBeNull();
  });
  it("never creates absent players, changes names/teams/roles or exposes source keys", () => {
    const a = supplementNpbDirectory(directory, reviewed).directory;
    expect(a.players).toHaveLength(1); expect(a.teams).toEqual(directory.teams);
    expect(a.players[0]!.bats).toBeNull(); expect(a.players[0]!.throws).toBeNull();
    const c = buildNpbCatalog(a, reviewedMeasurements, supplementNpbMeasurements(reviewedMeasurements, reviewed));
    expect(c.players[0]!.profile).toMatchObject({ heightCm: 190, weightKg: 95, measurementsObservedAt: at, measurementsEffectiveDate: null });
    expect(c.players[0]!.membership.uniformNumber).toBeNull();
    expect(JSON.stringify(c)).not.toMatch(/wikidata|npbId|Q52083715|nf3|sourceUrl/);
  });
  it("retains original per-snapshot measurement observation dates", () => {
    const original = { ...directory, players: [{ ...directory.players[0]!, playerId: reviewedMeasurements.players[1].playerId }] };
    const c = buildNpbCatalog(original, reviewedMeasurements, supplementNpbMeasurements(reviewedMeasurements, reviewed));
    expect(c.players[0]!.profile.measurementsObservedAt).toBe(reviewedMeasurements.observedAt);
  });
});
describe("saved-season checkpoints, independently of rankings/career", () => {
  it("keeps PA-independent zero counts, exact checkpoints and partial coverage", () => {
    const season = sampleMilestoneSeason(), before = JSON.stringify(season), p = buildNpbSeasonMilestones(season);
    expect(p.players[0]!.checkpoints).toEqual([
      { role: "batting", metric: "H", count: 50, previousCheckpoint: 50, nextCheckpoint: 100 },
      { role: "batting", metric: "HR", count: 0, previousCheckpoint: 0, nextCheckpoint: 10 }]);
    expect(p.coverage.status).toBe("partial"); expect(p.careerAvailable).toBe(false); expect(JSON.stringify(season)).toBe(before);
    expect(JSON.stringify(p)).not.toMatch(/rank|achievedAt|careerTotal|sourceId/);
  });
  it("does not replace incomplete/missing metrics with zero", () => {
    const s = sampleMilestoneSeason(); s.players[0]!.batting = null;
    expect(buildNpbSeasonMilestones(s).players).toEqual([]);
  });
  it("rejects malformed noninteger counting metrics", () => {
    const s = sampleMilestoneSeason(); s.players[0]!.batting!.metrics.H!.value = 49.5;
    expect(() => buildNpbSeasonMilestones(s)).toThrow(/integer/);
  });
  it("orders by name/canonical ID, never metric rank, across both roles", () => {
    const s = sampleMilestoneSeason(), other = structuredClone(s.players[0]!);
    other.playerId = "00000000-0000-4000-8000-000000000002"; other.displayName = "あいう";
    other.pitching = { factCount: 2, metrics: { W: metric(5), SO: metric(99) } } as unknown as NonNullable<typeof other.pitching>;
    s.players.push(other);
    const p = buildNpbSeasonMilestones(s); expect(p.players[0]!.displayName).toBe("あいう");
    expect(p.players[0]!.checkpoints.find(c => c.metric === "W")).toMatchObject({ previousCheckpoint: 5, nextCheckpoint: 10 });
  });
  it("does not open existing Production gates", () => {
    const catalog = buildNpbCatalog(directory, reviewedMeasurements), s = sampleMilestoneSeason();
    const c = buildNpbCapabilities(catalog, s, { status: "not_ready", reasons: ["scheduled_proof_pending"] });
    expect(c.data.seasonMilestones!.available).toBe(true);
    for (const key of ["hot", "countingRanking", "rateRanking", "records", "milestones", "careerStats", "directBvP"])
      expect(c.data[key]!.available).toBe(false);
  });
  it("rejects duplicate identities, invented checkpoint intervals and complete/partial contradiction", () => {
    const p = buildNpbSeasonMilestones(sampleMilestoneSeason());
    expect(npbSeasonMilestonesSchema.safeParse({ ...p, players: [...p.players, ...p.players] }).success).toBe(false);
    const changed = structuredClone(p); changed.players[0]!.checkpoints[0]!.nextCheckpoint = 101;
    expect(npbSeasonMilestonesSchema.safeParse(changed).success).toBe(false);
    expect(npbSeasonMilestonesSchema.safeParse({ ...p, coverage: { ...p.coverage, status: "complete" } }).success).toBe(false);
  });
  it("validates the static response and rejects a mismatched Season without DB access", async () => {
    let calls = 0; const p = buildNpbSeasonMilestones(sampleMilestoneSeason());
    const repository = new StaticNpbProductRepository("https://example.test/", async url => {
      calls++; expect(String(url)).toContain("data/npb/milestones/"); return Response.json(p);
    });
    expect(await repository.seasonMilestones(2026)).toEqual(p); expect(calls).toBe(1);
    await expect(repository.seasonMilestones(2025)).rejects.toThrow(/mismatch/);
    await expect(repository.seasonMilestones(Number.NaN)).rejects.toThrow(/Season/);
  });
});
