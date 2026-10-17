import { expect, it } from "vitest";
import { bestObservedSeasons, historicalProgression, observedClubChanges } from "../src/domain/npb-player-progression";
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
