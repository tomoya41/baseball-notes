import { expect, it } from "vitest";
import { bestObservedSeasons, historicalClubComparison, historicalProgression, observedClubChanges } from "../src/domain/npb-player-progression";
import { historicalBattingKeys, historicalPitchingKeys, npbHistoricalRowSchema } from "../src/domain/npb-historical";
import { comparisonValue } from "../src/domain/product-comparison";
import { portableRoute } from "../src/domain/product-sharing";
const id = "00000000-0000-4000-8000-000000000001";
const row = (year: number, role: "batting" | "pitching", metrics: Record<string, number | null>, team = "tigers") => npbHistoricalRowSchema.parse({ playerId: id, season: year, role, teamId: `npb:team:${team}`, metrics: { ...Object.fromEntries((role === "batting" ? historicalBattingKeys : historicalPitchingKeys).map(k => [k, null])), ...metrics } });
it("recomputes rates from club-year components, never an average, and retains a missing year", () => {
  const rows = [row(2023, "batting", { PA: 100, AB: 80, H: 20, HR: 4 }), row(2023, "batting", { PA: 200, AB: 180, H: 90, HR: 20 }, "giants")];
  const result = historicalProgression(rows, [2023, 2024]);
  expect(result[0]?.metrics.AVG).toBeCloseTo(110 / 260); expect(result[0]?.metrics.HR).toBe(24);
  expect(result[0]?.teams).toHaveLength(2); expect(result[1]?.metrics).toEqual({});
  expect(result[0]?.metrics.OPS).toBeNull(); expect(rows[0]?.metrics.AVG).toBeNull();
});
it("handles zero outs and keeps independent BB separate from unavailable HBP", () => {
  const points = historicalProgression([row(2024, "pitching", { G: 1, outsRecorded: 0, SO: 1, BB: 1, H: 1 }), row(2025, "pitching", { G: 10, outsRecorded: 90, SO: 30, BB: 10, H: 20 })], [2024, 2025]);
  expect(points[0]?.metrics.K9).toBeNull(); expect(points[0]?.metrics.BB9).toBeNull();
  expect(points[1]?.metrics.K9).toBe(9); expect(points[1]?.metrics.BB9).toBe(3); expect(points[1]?.metrics.WHIP).toBe(1);
  expect(points[1]?.metrics.HBP).toBeNull();
});
it("does not select extreme small samples as a rate high and preserves deterministic ties", () => {
  const points = historicalProgression([row(2023, "batting", { PA: 1, AB: 1, H: 1 }), row(2024, "batting", { PA: 100, AB: 100, H: 30 }), row(2025, "batting", { PA: 200, AB: 200, H: 60 })], [2025, 2023, 2024]);
  expect(bestObservedSeasons(points, "AVG").map(p => p.season)).toEqual([2024, 2025]);
  expect(bestObservedSeasons(points, "OPS")).toEqual([]);
});
it("rejects duplicate and mixed player/role observations", () => {
  const r = row(2025, "batting", { PA: 1 });
  expect(() => historicalProgression([r, r], [2025])).toThrow("Duplicate");
  expect(() => historicalProgression([r, { ...r, playerId: "other" }], [2025])).toThrow("One player");
});
it("compares only adjacent single-club years, without inventing transfer timing across missing or split seasons",()=>{
  const a=row(2022,"batting",{PA:100,AB:100,H:20}),b={...row(2023,"batting",{PA:200,AB:200,H:60}),teamId:"npb:team:hawks" as const};
  const points=historicalProgression([a,b],[2022,2023,2024]);
  expect(observedClubChanges(points)).toHaveLength(1);expect(observedClubChanges(points)[0]!.after.metrics.AVG).toBe(.3);
  expect(observedClubChanges(historicalProgression([a,{...b,season:2024}],[2022,2023,2024]))).toEqual([]);
  expect(observedClubChanges(historicalProgression([a,b,{...b,teamId:"npb:team:tigers"}],[2022,2023]))).toEqual([]);
});
it("keeps rates readable and a validated trend metric in share/deep-link state", () => {
  expect(comparisonValue("WHIP", 1.234)).toBe("1.23"); expect(comparisonValue("BB9", 2.345)).toBe("2.35");
  expect(portableRoute(`/NPB/players/${id}/seasons`, "season=2025&trendMetric=HR")).toContain("trendMetric=HR");
  expect(portableRoute(`/NPB/players/${id}/seasons`, "season=2025&trendMetric=secret")).not.toContain("trendMetric");
});

it("compares each club's actual selected rows, recomputes rates and lists gaps rather than inventing tenures", () => {
  const rows = [row(2022, "batting", { PA: 100, AB: 100, H: 20, HR: 1 }),
    row(2023, "batting", { PA: 200, AB: 200, H: 80, HR: 10 }, "giants"),
    row(2023, "batting", { PA: 50, AB: 50, H: 20, HR: 2 }),
    row(2025, "batting", { PA: 300, AB: 300, H: 90, HR: 4 }),
    row(2021, "batting", { PA: 999, AB: 999, H: 999, HR: 999 }, "hawks")];
  const original = structuredClone(rows), result = historicalClubComparison(rows, [2025, 2022, 2024, 2023]);
  expect(result.missingSeasons).toEqual([2024]);
  expect(result.clubs.map(c => c.teamId)).toEqual(["npb:team:tigers", "npb:team:giants"]);
  expect(result.clubs[0]?.seasons).toEqual([2022, 2023, 2025]);
  expect(result.clubs[0]?.metrics.AVG).toBeCloseTo(130 / 450); // Not a mean of three rates.
  expect(result.clubs[0]?.metrics.HR).toBe(7); expect(result.clubs[0]?.sample).toBe(450);
  expect(result.clubs[0]?.metrics.OPS).toBeNull(); expect(rows).toEqual(original);
});
it("retains partial pitching inputs, converts fractional innings by outs and excludes zero-out rate artifacts", () => {
  const result = historicalClubComparison([row(2023, "pitching", { outsRecorded: 89, SO: 30, BB: 10, H: 20, ER: 3 }),
    row(2025, "pitching", { outsRecorded: 1, SO: 0, BB: null, H: 1, ER: 0 }),
    row(2025, "pitching", { outsRecorded: 0, SO: 1, BB: 0, H: 0, ER: 1 }, "giants")], [2023, 2025]);
  expect(result.clubs[0]?.sample).toBe(90); expect(result.clubs[0]?.metrics.K9).toBe(9);
  expect(result.clubs[0]?.metrics.ERA).toBe(.9); expect(result.clubs[0]?.metrics.BB9).toBeNull();
  expect(result.clubs[0]?.metrics.WHIP).toBeNull(); expect(result.clubs[1]?.metrics.K9).toBeNull();
  expect(result.clubs[1]?.metrics.ERA).toBeNull();
});
it("rejects ambiguous identities/duplicate rows and bounds selected club-comparison years", () => {
  const r = row(2025, "batting", { PA: null });
  expect(historicalClubComparison([], [2025]).missingSeasons).toEqual([2025]);
  expect(() => historicalClubComparison([r, r], [2025])).toThrow("Duplicate");
  expect(() => historicalClubComparison([r, {...r, playerId: "other"}], [2025])).toThrow("One player");
  expect(() => historicalClubComparison([r, row(2024, "pitching", {})], [2025])).toThrow("One player");
  expect(() => historicalClubComparison([r], [2021, 2022, 2023, 2024, 2025])).toThrow("four");
  expect(historicalClubComparison([r], [2025, 2025]).clubs[0]?.sample).toBeNull();
});
