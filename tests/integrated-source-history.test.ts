import { describe, expect, it } from "vitest";
import { sourceReadinessSchema, assessDailyObservation, npbObservationDate, type DailyObservation } from "../src/domain/source-readiness";
import { npbCsFinal2026 } from "../src/domain/npb-cs-rule";
import { historicalAdvancedGate } from "../src/domain/mlb-pa-analysis";
import { MLB_HISTORICAL_SEASONS } from "../src/domain/mlb-historical-seasons";
import { mlbPostseasonBestOf } from "../src/data/mlb-postseason";
import { isRegularRetrosheetGame } from "../src/data/mlb-historical";
import { collectedCountingRecords } from "../src/domain/mlb-collected-records";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { hasHistoricalSourceAttribution, HISTORICAL_PUBLIC_ARCHIVE_ATTRIBUTION } from "../src/data/mlb-public-archive";

const fixture: DailyObservation = { source: "fixture-only", sourceGameId: "sample", league: "NPB", competition: "regular", season: 2026,
  playedAt: "2026-09-24T15:30:00Z", observedAt: "2026-09-25T12:00:00Z", effectiveDate: "2026-09-25",
  homeTeamId: "home", awayTeamId: "away", status: "final", homeScore: 1, awayScore: 0,
  complete: true, playerStatsComplete: true, unresolvedIdentities: 0 };
describe("Free daily-source readiness, isolated from Production", () => {
  it("requires complete free permission evidence and stats for FULL_READY", () => {
    const source = { source: "fixture", league: "NPB", competition: "regular", season: 2026, status: "FULL_READY",
      costTier: "permanent_free", coverage: "complete", fields: { schedule: true, score: true, batting: true, pitching: true, pa: false },
      permissions: { acquisition: "allowed", storage: "allowed", publicDisplay: "allowed", redistribution: "allowed" },
      provenance: { termsUrl: "https://example.org/terms", checkedAt: fixture.observedAt, notes: "fixture only" } };
    expect(sourceReadinessSchema.safeParse(source).success).toBe(true);
    for (const costTier of ["trial", "paid", "unknown"]) expect(sourceReadinessSchema.safeParse({ ...source, costTier }).success).toBe(false);
    for (const key of Object.keys(source.permissions)) expect(sourceReadinessSchema.safeParse({ ...source, permissions: { ...source.permissions, [key]: "unknown" } }).success).toBe(false);
    expect(sourceReadinessSchema.safeParse({ ...source, fields: { ...source.fields, batting: false } }).success).toBe(false);
    expect(sourceReadinessSchema.safeParse({ ...source, status: "SCORE_READY", fields: { ...source.fields, batting: false, pitching: false } }).success).toBe(true);
  });
  it("uses JST and is idempotent without treating a re-fetch as an update", () => {
    expect(npbObservationDate(fixture.playedAt)).toBe("2026-09-25");
    expect(assessDailyObservation(fixture).status).toBe("validated_shadow");
    expect(assessDailyObservation({ ...fixture, observedAt: "2026-09-26T00:00:00Z" }, fixture).status).toBe("unchanged");
  });
  it.each(["postponed", "suspended", "scheduled"] as const)("quarantines %s instead of inventing a final", status => {
    expect(assessDailyObservation({ ...fixture, status }).status).toBe("quarantined");
  });
  it.each([{ complete: false }, { playerStatsComplete: false }, { unresolvedIdentities: 1 }, { homeTeamId: null },
    { homeScore: null }, { effectiveDate: "2026-09-24" }, { season: 2025 }])("keeps incomplete/unknown/date mismatches out", changes => {
    expect(assessDailyObservation({ ...fixture, ...changes }).status).toBe("quarantined");
  });
  it("does not resolve source conflicts, corrections or stale observations by majority", () => {
    expect(assessDailyObservation({ ...fixture, source: "other" }, fixture).reasons).toContain("source_or_scope_conflict");
    expect(assessDailyObservation({ ...fixture, homeScore: 2 }, fixture).reasons).toContain("correction_requires_review");
    expect(assessDailyObservation({ ...fixture, observedAt: "2026-09-25T11:00:00Z" }, fixture).reasons).toContain("stale_observation");
    expect(assessDailyObservation({ ...fixture, competition: "postseason" }, fixture).reasons).toContain("source_or_scope_conflict");
  });
  it("bounds retry budget and rejects invalid input", () => {
    expect(assessDailyObservation({ ...fixture, complete: false }, undefined, 1).retryAllowed).toBe(true);
    expect(assessDailyObservation({ ...fixture, complete: false }, undefined, 2).retryAllowed).toBe(false);
    expect(assessDailyObservation({ ...fixture, unresolvedIdentities: 1 }).retryAllowed).toBe(false);
    expect(assessDailyObservation({}).status).toBe("invalid");
  });
});
describe("Collected period counting records", () => {
  it("preserves previously attributed archives while rejecting missing credits", () => {
    expect(hasHistoricalSourceAttribution(HISTORICAL_PUBLIC_ARCHIVE_ATTRIBUTION)).toBe(true);
    expect(hasHistoricalSourceAttribution(HISTORICAL_PUBLIC_ARCHIVE_ATTRIBUTION.replace("historical seasons identified in the manifest", "2020–2025 seasons"))).toBe(true);
    expect(hasHistoricalSourceAttribution(null)).toBe(false);
    expect(hasHistoricalSourceAttribution("Retrosheet + Chadwick Register")).toBe(false);
  });
  it("adds only known values, preserves ties and excludes unknown/partial metrics", () => {
    const lines = [
      { playerId: "a", batting: { H: { value: 5 } }, pitching: null },
      { playerId: "a", batting: { H: { value: 2 } }, pitching: null },
      { playerId: "b", batting: { H: { value: 7 } }, pitching: null },
      { playerId: "c", batting: { H: { value: null } }, pitching: null },
      { playerId: "c", batting: { H: { value: 99 } }, pitching: null },
      { playerId: "d", batting: { H: { value: 100, status: "partial" } }, pitching: null },
    ];
    const rows = collectedCountingRecords(lines, new Map([ ["a", "A"], ["b", "B"], ["c", "C"], ["d", "D"] ]))[0]!.rows;
    expect(rows.map(r => [r.playerId, r.value, r.rank])).toEqual([["a", 7, 1], ["b", 7, 1]]);
  });
  it("validates scope and decade without inventing a full Career or rate title", () => {
    const record = { schemaVersion: 1, league: "MLB", collectedSeasons: [2016, 2017], coverage: "complete", counting: "ready", rate: "not_ready", records: [] };
    expect(validStaticPayload("records/decade-2010.json", record)).toBe(true);
    expect(validStaticPayload("records/decade-2020.json", record)).toBe(false);
    expect(validStaticPayload("records/range.json", { ...record, collectedSeasons: [2017, 2016] })).toBe(false);
    expect(validStaticPayload("records/range.json", { ...record, competitionType: "postseason" })).toBe(false);
    expect(validStaticPayload("postseason/records/range.json", { ...record, competitionType: "postseason" })).toBe(true);
    expect(validStaticPayload("records/range.json", { ...record, rate: "ready" })).toBe(false);
  });
});
describe("Verified competition formats and per-season gates", () => {
  it("keeps Game 163 regular and WC postseason, in both Game and PA filtering", () => {
    expect(isRegularRetrosheetGame("playoff")).toBe(true);
    expect(isRegularRetrosheetGame("regular")).toBe(true);
    expect(isRegularRetrosheetGame("wildcard")).toBe(false);
    expect(isRegularRetrosheetGame("allstar")).toBe(false);
  });
  it.each([2016, 2017, 2018, 2019, 2021])("verifies %s single-game Wild Card format", year => {
    expect(mlbPostseasonBestOf(year, "wild_card")).toBe(1);
    expect(mlbPostseasonBestOf(year, "division_series")).toBe(5);
    expect(mlbPostseasonBestOf(year, "world_series")).toBe(7);
  });
  it("requires every advertised year and explanation-free validation", () => {
    const reports = MLB_HISTORICAL_SEASONS.map(season => ({ season, expectedGames: 1, games: 1, reconstructedGames: 1,
      skippedGames: 0, parserFailures: 0, identityUnresolved: 0, mismatches: [], stateIssues: {} }));
    expect(historicalAdvancedGate(reports, MLB_HISTORICAL_SEASONS).directBvp).toBe("ready");
    expect(historicalAdvancedGate(reports.slice(1), MLB_HISTORICAL_SEASONS).directBvp).toBe("not_ready");
    expect(historicalAdvancedGate([...reports, reports[0]!], MLB_HISTORICAL_SEASONS).directBvp).toBe("not_ready");
    expect(historicalAdvancedGate(reports.map((r, i) => i ? r : { ...r, mismatches: ["unknown"] }), MLB_HISTORICAL_SEASONS).directBvp).toBe("not_ready");
  });
  it("models conditional 2026 NPB advantage separately, without any Game", () => {
    expect(npbCsFinal2026({ gamesBehind: 9.5, wins: 70, losses: 70 })).toEqual({ advantageWins: 1, maximumPlayedGames: 6, winsRequired: 4 });
    expect(npbCsFinal2026({ gamesBehind: 10, wins: 70, losses: 70 })?.advantageWins).toBe(2);
    expect(npbCsFinal2026({ gamesBehind: 1, wins: 69, losses: 70 })?.advantageWins).toBe(2);
    expect(npbCsFinal2026({ gamesBehind: null, wins: null, losses: null })).toBeNull();
    expect(npbCsFinal2026({ gamesBehind: 10, wins: null, losses: null })?.advantageWins).toBe(2);
    expect(npbCsFinal2026({ gamesBehind: 9, wins: null, losses: null })).toBeNull();
  });
});
