import { describe, expect, it } from "vitest";
import { comparisonDisplayExport, displayCsv, portableRoute, portableUrl, RETROSHEET_EXPORT_CREDIT, type DisplayExport } from "../src/domain/product-sharing";
import { collectionSeasonCheckpoint, comparisonValue, metricNumber, previousYearDelta, selectedTeams, selectedYears, type ComparisonRow } from "../src/domain/product-comparison";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
const id = "00000000-0000-4000-8000-000000000001", team = `mlb:team:${id}`;
describe("portable comparison state", () => {
  it("never copies local, invalid or other-league comparison identities into public URLs", () => {
    const bad = new URLSearchParams(portableRoute("/MLB/compare", "against=local-123&opponent=secret")!.split("?")[1]);
    expect(bad.has("against")).toBe(false); expect(bad.has("opponent")).toBe(false);
    const good = new URLSearchParams(portableRoute("/MLB/compare", `against=mlb:player:${id}&opponent=${team}`)!.split("?")[1]);
    expect(good.get("against")).toBe(`mlb:player:${id}`); expect(good.get("opponent")).toBe(team);
    const npb = new URLSearchParams(portableRoute("/NPB/compare", `against=mlb:player:${id}&opponent=${team}`)!.split("?")[1]);
    expect(npb.has("against")).toBe(false); expect(npb.has("opponent")).toBe(false);
  });
  it("reuses stored-season checkpoint steps without inventing career or unavailable counts", () => {
    expect(collectionSeasonCheckpoint({ H: { value: 100, status: "partial" }, HR: { value: null } }, "batting")).toBe("安打 100 / 節目 150"); expect(collectionSeasonCheckpoint(null, "pitching")).toBe("");
  });
  it("shares canonical teams, scope and condition without local IDs", () => {
    const result = portableUrl("/MLB/team-compare", `teams=${team},${team},npb:team:tigers&season=2025&competition=postseason&view=14&localId=private&metric=OPS`)!;
    const query = new URLSearchParams(result.split("?")[1]);
    expect(query.get("teams")).toBe(team); expect(query.get("competition")).toBe("postseason"); expect(query.has("localId")).toBe(false); expect(result.startsWith("https://tomoya41.github.io/")).toBe(true);
    expect(canonicalDeepLink(result)).toBe(result.split("#")[1]);
  });
  it("shares Explorer filters rather than a Saved View internal ID", () => {
    const q = new URLSearchParams(portableRoute("/NPB/data", "period=14&sort1=OPS&minimum=20&metrics=OPS,HR&metric1=OPS&value1=.8&viewId=private&credential=secret")!.split("?")[1]);
    expect(q.get("period")).toBe("14"); expect(q.get("metrics")).toBe("OPS,HR"); expect(q.has("viewId")).toBe(false); expect(q.has("credential")).toBe(false);
  });
  it("never shares Collections, local dashboards or arbitrary routes", () => {
    for (const route of ["/NPB/library", "/MLB/library/collections/local-1", "/MLB/private", `/NPB/players/mlb:player:${id}`, "/XXX/data"]) expect(portableRoute(route)).toBeNull();
  });
  it("isolates leagues and bounds 2–4 selection", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `mlb:team:00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(selectedTeams("MLB", [...ids, "npb:team:tigers"].join(","))).toEqual(ids.slice(0, 4)); expect(selectedTeams("NPB", team)).toEqual([]);
  });
  it("rejects unsupported years and respects an explicitly empty selection", () => {
    expect(selectedYears(null, [2025, 2020, 2024])).toEqual([2020, 2024, 2025]); expect(selectedYears("", [2025])).toEqual([]); expect(selectedYears("2026", [2025])).toEqual([]); expect(selectedYears("2025,2025", [2025])).toEqual([2025]);
  });
  it("uses a true prior-year delta, never a previous collected-year delta", () => {
    const row = (season: number, value: number | null): ComparisonRow => ({ id: String(season), name: "選手", season, date: `${season}-09-30`, coverage: "complete", metrics: { H: { value, status: value === null ? "unavailable" : "complete" } } });
    const rows = [row(2020, 20), row(2022, 30), row(2023, 35), row(2024, null)]; expect(previousYearDelta(rows, rows[1]!, "H")).toBeNull(); expect(previousYearDelta(rows, rows[2]!, "H")).toBe(5); expect(previousYearDelta(rows, rows[3]!, "H")).toBeNull();
  });
  it("preserves nulls, partial values and fractional IP without inferred zero", () => {
    expect(metricNumber({ H: { value: 0, status: "unavailable" } }, "H")).toBeNull(); expect(metricNumber({ H: { value: 2, status: "partial" } }, "H")).toBe(2); expect(comparisonValue("outsRecorded", 5)).toBe("1.2"); expect(comparisonValue("OPS", null)).toBe("—");
  });
  it("restores canonical season comparisons on native deep link and has a dashboard parent", () => {
    const route = `/MLB/season-compare?kind=team&entity=${encodeURIComponent(team)}&years=2024%2C2025&competition=postseason`;
    expect(canonicalDeepLink(`baseballnotes://${route.slice(1)}`)).toBe(route); expect(parentNativeRoute("/NPB/library/collections/local-1")).toBe("/NPB/library"); expect(parentNativeRoute("/MLB/team-compare?competition=postseason&season=2025")).toBe("/MLB/search?competition=postseason&season=2025");
  });
});
const data: DisplayExport = { league: "MLB", scope: "2025 Regular Season selected players", date: "2025-09-28", coverage: "partial", columns: ["選手", "H", "OPS"], rows: [["大谷翔平", 172, 1.014], ["=unsafe", null, 0], ["quoted \"name\"", -2, null]] };
describe("bounded derived-result exports", () => {
  it("keeps every displayed player with null cells and partial coverage for no facts or a failed read", () => {
    const result = comparisonDisplayExport("MLB", "2025 batting", "2025-09-28", ["H", "OPS"], [{ name: "known", coverage: "complete", metrics: { H: { value: 2, status: "complete" }, OPS: { value: .9, status: "complete" } } }, { name: "no batting facts", coverage: "complete", metrics: null }, { name: "read failed", coverage: "unavailable", metrics: null }]);
    expect(result.rows).toEqual([["known", 2, .9], ["no batting facts", null, null], ["read failed", null, null]]); expect(result.coverage).toBe("partial"); expect(displayCsv(result)).toContain('"no batting facts","",""');
  });
  it.each(["partial", "unavailable", "unknown"])("preserves %s source coverage even with complete metric cells", coverage => {
    const result = comparisonDisplayExport("MLB", "2025 batting", "2025-09-28", ["H"], [{ name: "known", coverage, metrics: { H: { value: 2, status: "complete" } } }]);
    expect(result.coverage).toBe("partial"); expect(displayCsv(result)).toContain("Coverage: partial");
  });
  it("preserves credit, scope, null and real zero; escapes formula/string cells", () => {
    const csv = displayCsv(data); expect(csv).toContain(RETROSHEET_EXPORT_CREDIT.replaceAll('"', '""')); expect(csv).toContain("Chadwick Register"); expect(csv).toContain("Coverage: partial"); expect(csv).toContain('"\'=unsafe","","0"'); expect(csv).toContain('"quoted ""name""","-2",""');
  });
  it("does not extend the provisional NPB rights to CSV export", () => { expect(() => displayCsv({ ...data, league: "NPB" })).toThrow(); });
  it("cannot output archives, more than 40 displayed rows or invalid tables", () => {
    expect(() => displayCsv({ ...data, rows: Array(41).fill(data.rows[0]) })).toThrow(); expect(() => displayCsv({ ...data, columns: Array(21).fill("metric") })).toThrow(); expect(() => displayCsv({ ...data, rows: [["wrong width"]] })).toThrow();
  });
});
