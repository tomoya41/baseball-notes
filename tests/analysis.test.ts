import { describe, expect, it } from "vitest";
import {
  analysisQuerySchema,
  analysisResultSchema,
  canCompareCoordinates,
  capabilityManifestSchema,
  sampleWarning,
  velocityBandSchema,
} from "../src/domain/analysis";
import type {
  AnalysisCapabilities,
  AnalysisQuery,
  CoordinateDefinition,
} from "../src/domain/analysis";
import {
  analysisQueryKey,
  assessAnalysisQuery,
  dateInZone,
  resolveAnalysisWindow,
} from "../src/domain/analysis-query";
import {
  foundationAnalysisCapabilities,
  samplePolicy,
} from "../src/app/analysis-policy";

const now = Date.parse("2026-09-23T10:00:00Z");
function query(): AnalysisQuery {
  return analysisQuerySchema.parse({
    version: 2,
    league: "MLB",
    subject: { kind: "batter", playerId: "player-1" },
    asOfDate: "2026-09-23",
    timeZone: "America/New_York",
    period: { kind: "season", year: 2026 },
    seasonType: "regular",
    population: "plate-appearances",
    metricIds: ["avg"],
    groupBy: "none",
    filters: {
      opponent: { kind: "all" },
      bases: "all",
      outs: null,
      count: { kind: "all" },
      pitchType: null,
      velocity: null,
      catcherId: null,
      homeAway: "all",
      battingOrder: null,
      scoreDifferential: { kind: "all" },
      gameInning: null,
      appearanceInning: null,
    },
  });
}
// Test-only licensed manifest; never connected to the app or confused with live data.
function enabled(): AnalysisCapabilities {
  const manifest = foundationAnalysisCapabilities("MLB");
  manifest.subjects = ["batter", "pitcher", "matchup"];
  manifest.seasonTypes = ["regular"];
  manifest.coverage = { from: "2026-01-01", through: "2026-09-22" };
  manifest.features.basicStats = {
    status: "available",
    implementation: "implemented",
    reason: "test only",
    evidence: ["test contract"],
  };
  manifest.metricRequirements = { avg: [] };
  manifest.periods = ["season"];
  manifest.populations = ["plate-appearances"];
  manifest.supportedCombinations = [["basicStats"]];
  return capabilityManifestSchema.parse(manifest);
}
describe("analysis query validation", () => {
  it("requires explicit reached-PA vs pitch-at-count semantics", () => {
    const q = query();
    q.filters.count = { kind: "exact", state: { balls: 0, strikes: 2 } };
    expect(analysisQuerySchema.safeParse(q).success).toBe(false);
    q.population = "plate-appearance-reached-count";
    expect(analysisQuerySchema.safeParse(q).success).toBe(true);
    const a = analysisQueryKey(q);
    q.population = "pitch-at-count";
    expect(analysisQueryKey(q)).not.toBe(a);
  });
  it("rejects unknown filters, invalid calendar dates and impossible counts", () => {
    const q = query();
    expect(
      analysisQuerySchema.safeParse({
        ...q,
        filters: { ...q.filters, undocumentedFilter: 1 },
      }).success,
    ).toBe(false);
    expect(
      analysisQuerySchema.safeParse({ ...q, asOfDate: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      analysisQuerySchema.safeParse({ ...q, timeZone: "Mars/Olympus" }).success,
    ).toBe(false);
    expect(
      analysisQuerySchema.safeParse({
        ...q,
        population: "pitch-at-count",
        filters: {
          ...q.filters,
          count: { kind: "exact", state: { balls: 4, strikes: 0 } },
        },
      }).success,
    ).toBe(false);
  });
  it("does not allow a batter-opponent filter for a batter subject", () => {
    const q = query();
    q.filters.opponent = { kind: "batter", playerId: "batter-2" };
    expect(analysisQuerySchema.safeParse(q).success).toBe(false);
  });
  it("uses explicit non-overlapping velocity interval boundaries", () => {
    expect(
      velocityBandSchema.safeParse({
        unit: "mph",
        minInclusive: 95,
        maxExclusive: 95,
      }).success,
    ).toBe(false);
    expect(
      velocityBandSchema.safeParse({
        unit: "mph",
        minInclusive: 95,
        maxExclusive: 97,
      }).success,
    ).toBe(true);
  });
  it("canonicalizes metric ordering and retains all filters in query identity", () => {
    const q = query();
    q.metricIds = ["ops", "avg"];
    const key = analysisQueryKey(q);
    q.metricIds.reverse();
    expect(analysisQueryKey(q)).toBe(key);
    q.filters.outs = 0;
    expect(analysisQueryKey(q)).not.toBe(key);
    const withOuts = analysisQueryKey(q);
    q.filters.catcherId = "catcher-1";
    expect(analysisQueryKey(q)).not.toBe(withOuts);
  });
});
describe("calendar windows exclude the reference day", () => {
  it.each([7, 14, 30] as const)("resolves %i calendar days", (days) => {
    const q = query();
    q.period = { kind: "last-days", days };
    const window = resolveAnalysisWindow(q, now)!;
    expect(window.endDate).toBe("2026-09-22");
    expect(
      (Date.parse(window.endDate) - Date.parse(window.startDate)) / 86_400_000 +
        1,
    ).toBe(days);
  });
  it("handles leap February and previous-month year boundaries", () => {
    const q = query();
    q.asOfDate = "2024-03-01";
    q.period = { kind: "previous-month" };
    expect(resolveAnalysisWindow(q, now)).toEqual({
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
    q.asOfDate = "2026-01-01";
    expect(resolveAnalysisWindow(q, now)).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });
  it("returns no completed current-month window on the first day", () => {
    const q = query();
    q.asOfDate = "2026-09-01";
    q.period = { kind: "current-month" };
    expect(resolveAnalysisWindow(q, now)).toBeNull();
  });
  it("handles timezone day boundaries and DST without 24-hour local subtraction", () => {
    const instant = Date.parse("2026-03-09T03:00:00Z");
    expect(dateInZone(instant, "America/New_York")).toBe("2026-03-08");
    expect(dateInZone(instant, "Asia/Tokyo")).toBe("2026-03-09");
    const q = query();
    q.asOfDate = "2026-03-09";
    q.period = { kind: "last-days", days: 7 };
    expect(resolveAnalysisWindow(q, now)).toEqual({
      startDate: "2026-03-02",
      endDate: "2026-03-08",
    });
  });
  it("rejects a custom interval containing today and a future reference date", () => {
    const q = query();
    q.period = {
      kind: "custom",
      startDate: "2026-09-01",
      endDate: "2026-09-23",
    };
    expect(() => resolveAnalysisWindow(q, now)).toThrow();
    q.asOfDate = "2027-01-01";
    expect(() => resolveAnalysisWindow(q, now)).toThrow();
  });
});
describe("capability gate", () => {
  it.each(["NPB", "MLB"] as const)(
    "does not enable analysis from sample catalogs (%s)",
    (league) => {
      const q = query();
      q.league = league;
      expect(
        assessAnalysisQuery(q, foundationAnalysisCapabilities(league)).enabled,
      ).toBe(false);
    },
  );
  it("uses the manifest, not a hardcoded MLB/NPB permission", () => {
    const q = query();
    q.league = "NPB";
    const manifest = enabled();
    manifest.league = "NPB";
    expect(assessAnalysisQuery(q, manifest)).toEqual({ enabled: true });
  });
  it.each(["conditional", "research", "prohibited", "unavailable"] as const)(
    "fails closed for %s even if the feature is implemented",
    (status) => {
      const manifest = enabled();
      manifest.features.basicStats.status = status;
      expect(assessAnalysisQuery(query(), manifest)).toMatchObject({
        enabled: false,
        status: "unavailable",
      });
    },
  );
  it("distinguishes not implemented from missing data", () => {
    const manifest = enabled();
    manifest.features.basicStats.implementation = "not-implemented";
    expect(assessAnalysisQuery(query(), manifest)).toMatchObject({
      enabled: false,
      status: "not-implemented",
    });
  });
  it("rejects unsupported filters and unverified combinations instead of ignoring them", () => {
    const q = query();
    q.filters.outs = 0;
    const manifest = enabled();
    expect(assessAnalysisQuery(q, manifest).enabled).toBe(false);
    manifest.features.outsSplit = { ...manifest.features.basicStats };
    expect(assessAnalysisQuery(q, manifest)).toMatchObject({ enabled: false });
    manifest.supportedCombinations.push(["outsSplit", "basicStats"]);
    expect(assessAnalysisQuery(q, manifest).enabled).toBe(true);
  });
  it("rejects unknown metric ids, including inherited object properties", () => {
    const q = query();
    q.metricIds = ["constructor"];
    expect(assessAnalysisQuery(q, enabled()).enabled).toBe(false);
  });
  it("does not enable an unsupported season type or uncovered current season", () => {
    const q = query();
    q.seasonType = "postseason";
    expect(assessAnalysisQuery(q, enabled(), now).enabled).toBe(false);
    const manifest = enabled();
    manifest.coverage = { from: "2025-01-01", through: "2025-12-31" };
    expect(assessAnalysisQuery(query(), manifest, now).enabled).toBe(false);
  });
});
describe("sample sizes and coordinate provenance", () => {
  it("keeps zero, missing and threshold boundary separate and accepts policy changes", () => {
    expect(sampleWarning({ PA: 0 }, "battingSplit", samplePolicy)).toContain(
      "参考値",
    );
    expect(sampleWarning({}, "battingSplit", samplePolicy)).toContain("不明");
    expect(sampleWarning({ PA: 19 }, "battingSplit", samplePolicy)).toContain(
      "参考値",
    );
    expect(sampleWarning({ PA: 20 }, "battingSplit", samplePolicy)).toBeNull();
    expect(
      sampleWarning({ PA: 20 }, "battingSplit", {
        revision: "v2",
        rules: { battingSplit: { unit: "PA", warnBelow: 30 } },
      }),
    ).toContain("参考値");
    expect(sampleWarning({ pitches: 99 }, "battery", samplePolicy)).toContain(
      "参考値",
    );
    expect(sampleWarning({ pitches: 100 }, "battery", samplePolicy)).toBeNull();
  });
  it("does not equate pre-2026 and 2026 Statcast coordinate definitions", () => {
    const a: CoordinateDefinition = {
      systemId: "statcast",
      version: "through-2025",
      units: "feet",
      viewpoint: "catcher",
      plane: "front-of-plate",
      zoneDefinition: "operator",
    };
    expect(canCompareCoordinates(a, { ...a })).toBe(true);
    expect(
      canCompareCoordinates(a, {
        ...a,
        version: "2026",
        plane: "middle-of-plate",
        zoneDefinition: "ABS",
      }),
    ).toBe(false);
  });
  it("keeps empty, unavailable and not-implemented results distinguishable", () => {
    for (const status of ["unavailable", "not-implemented"])
      expect(
        analysisResultSchema.parse({ status, query: query(), reason: "test" })
          .status,
      ).toBe(status);
  });
  it("requires cutoff and provenance even for a genuine empty result", () => {
    const empty = {
      status: "empty",
      query: query(),
      reason: "No observations",
      source: {
        providerId: "test",
        label: "test",
        kind: "sample",
        license: "test",
        revision: "1",
        updatedAt: "2026-09-23T00:00:00Z",
      },
      aggregationVersion: "1",
      aggregatedAt: "2026-09-23T05:00:00Z",
      coverage: {
        startDate: "2026-01-01",
        endDate: "2026-09-22",
        completeThrough: "2026-09-22",
        timeZone: "America/New_York",
        completeness: "complete",
      },
      freshness: {
        fetchedAt: "2026-09-23T06:00:00Z",
        expiresAt: "2026-09-24T06:00:00Z",
        state: "fresh",
        origin: "provider",
      },
      coordinates: null,
      splits: [],
      warnings: [],
    };
    expect(analysisResultSchema.safeParse(empty).success).toBe(true);
    expect(
      analysisResultSchema.safeParse({
        status: "empty",
        query: query(),
        reason: "No observations",
      }).success,
    ).toBe(false);
    expect(
      analysisResultSchema.safeParse({
        ...empty,
        coverage: { ...empty.coverage, completeThrough: "2026-09-23" },
      }).success,
    ).toBe(false);
    expect(
      analysisResultSchema.safeParse({
        ...empty,
        query: { ...query(), groupBy: "zone" },
      }).success,
    ).toBe(false);
  });
});
