import { beforeEach, describe, expect, it, vi } from "vitest";
import { boundedComparisonRead, readMlbTeamComparison, readNpbTeamComparison, teamMetrics } from "../src/application/product-comparison";
import type { Services } from "../src/app/services";
const reader = vi.hoisted(() => vi.fn());
vi.mock("../src/app/historical-products", () => ({ readHistoricalProduct: reader }));
beforeEach(() => reader.mockReset());
const date = "2026-10-03", generatedAt = `${date}T10:00:00Z`, team = "npb:team:tigers";
function npb() {
  return { product: { catalog: vi.fn().mockResolvedValue({ effectiveDate: date, generatedAt, teams: [{ teamId: team, name: "阪神" }] }), teamSeason: vi.fn().mockResolvedValue({ season: 2026, effectiveDate: date, generatedAt, coverage: { status: "partial" }, teams: [{ teamId: team, G: 1, W: 1, L: 0, T: 0, runsFor: 3, runsAgainst: 1, batting: { H: { value: 8, status: "partial" } }, pitching: {} }] }) }, gameSurface: { manifest: vi.fn().mockResolvedValue({ from: "2026-09-20", effectiveDate: date }), date: vi.fn().mockResolvedValue({ games: [], coverage: "no_games" }) } };
}
describe("bounded read-only comparison", () => {
  it("limits concurrency to three and keeps settled failures in original order", async () => {
    let current = 0, maximum = 0;
    const rows = await boundedComparisonRead(["a", "b", "c", "d"], async id => { current++; maximum = Math.max(maximum, current); await Promise.resolve(); current--; if (id === "b") throw Error("offline"); return id; });
    expect(maximum).toBe(3); expect(rows.map(r => r.status)).toEqual(["fulfilled", "rejected", "fulfilled", "fulfilled"]); await expect(boundedComparisonRead(Array(15).fill("x"), async () => 1)).rejects.toThrow();
  });
  it("maps distinct batting and pitching metrics with nullable scores", () => {
    const r = teamMetrics({ G: 1, W: 1, L: 0, T: 0, runsFor: null, runsAgainst: null, batting: { H: { value: 8, status: "complete" }, SO: { value: 4 } }, pitching: { H: { value: 3 }, SO: { value: 10, status: "complete" } } }, "partial");
    expect(r.H!.value).toBe(8); expect(r.SO!.value).toBe(10); expect(r.runDifference!.value).toBeNull(); expect(r.W!.status).toBe("partial"); expect(r).not.toHaveProperty("rank");
  });
  it("reads NPB one catalog and one coordinated Team Season; preserves gate status", async () => {
    const s = npb(), r = await readNpbTeamComparison(s as unknown as Services); expect(r[0]!.metrics!.H!.value).toBe(8); expect(r[0]!.coverage).toBe("partial"); expect(s.product.teamSeason).toHaveBeenCalledOnce(); expect(s.gameSurface.date).not.toHaveBeenCalled();
  });
  it.each(["effectiveDate", "generatedAt"])("rejects mismatched NPB %s instead of mixing generations", async k => {
    const s = npb(); s.product.catalog.mockResolvedValue({ ...await s.product.catalog(), [k]: "mismatch" }); await expect(readNpbTeamComparison(s as unknown as Services)).rejects.toThrow("generation");
  });
  it("uses final results only, explicit Recent window, and no manufactured batting stats", async () => {
    const s = npb(); s.gameSurface.date.mockImplementation(async d => ({ coverage: d === date ? "partial" : "no_games", games: d === date ? [{ status: "final", home: { id: team, score: 3 }, away: { id: "npb:team:carp", score: 1 } }, { status: "scheduled", home: { id: team, score: null }, away: { id: "npb:team:carp", score: null } }] : [] }) as never);
    const r = await readNpbTeamComparison(s as unknown as Services, "14"); expect(r[0]!.metrics!.G!.value).toBe(1); expect(r[0]!.metrics!.W!.value).toBe(1); expect(r[0]!.metrics).not.toHaveProperty("OPS"); expect(r[0]!.coverage).toBe("partial"); expect(s.gameSurface.date).toHaveBeenCalledTimes(14);
  });
  it("does not turn missing final scores or failed date pages into zeros", async () => {
    const s = npb(); s.gameSurface.date.mockResolvedValue({ coverage: "partial", games: [{ status: "final", home: { id: team, score: null }, away: { id: "npb:team:carp", score: 1 } }] } as never); const r = await readNpbTeamComparison(s as unknown as Services, "14"); expect(r[0]!.metrics!.W!.value).toBeNull(); expect(r[0]!.metrics!.runsFor!.value).toBeNull(); s.gameSurface.date.mockRejectedValue(Error("offline")); await expect(readNpbTeamComparison(s as unknown as Services, "14")).rejects.toThrow("incomplete");
  });
  it("reads MLB correct competition and treats ungenerated split as unavailable", async () => {
    const id = "mlb:team:00000000-0000-4000-8000-000000000001"; reader.mockResolvedValue({ teamId: id, season: 2025, competitionType: "postseason", effectiveDate: "2025-11-01", coverage: "complete" }); const r = await readMlbTeamComparison(id, "球団", 2025, "postseason", "14"); expect(reader.mock.calls[0]![0]).toMatch(/^postseason\/teams\/2025\//); expect(r.metrics).toBeNull(); await expect(readMlbTeamComparison(id, "球団", 2025, "regular")).rejects.toThrow("context");
  });
});
