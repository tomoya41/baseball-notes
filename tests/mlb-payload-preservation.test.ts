import { describe, expect, it } from "vitest";
import { equivalentHistoricalPayload, protectedHistoricalPath } from "../scripts/lib/mlb-payload-preservation";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { mlbRecordPlayerRoute } from "../src/domain/mlb-record-navigation";

describe("Historical immutable payload preservation", () => {
  const a = { season: 2020, players: [{ playerId: "a", batting: { H: 12 } }, { playerId: "b", batting: { H: null } }] };
  const b = { season: 2020, players: [...a.players].reverse() };
  it("allows only stable-key Season row reordering", () => {
    expect(equivalentHistoricalPayload("seasons/2020.json.gz", a, b)).toBe(true);
    expect(equivalentHistoricalPayload("postseason/seasons/2020.json.gz", a, b)).toBe(true);
    expect(equivalentHistoricalPayload("games/example.json.gz", a, b)).toBe(false);
  });
  it("rejects changed Facts, null conversion, duplicate identity and missing rows", () => {
    for (const players of [[{ playerId: "a", batting: { H: 13 } }, a.players[1]], [{ playerId: "a", batting: { H: 12 } }, { playerId: "b", batting: { H: 0 } }], [a.players[0], a.players[0]], [a.players[0]]]) {
      expect(equivalentHistoricalPayload("seasons/2020.json.gz", a, { ...a, players })).toBe(false);
    }
  });
  it("keeps expansion aggregates and mutable profile unions outside immutable bytes", () => {
    for (const path of ["records/range.json.gz", "postseason/records/decade-2020.json.gz", "players/index.json.gz", "players/a.json.gz", "manifest.json.gz"]) expect(protectedHistoricalPath(path)).toBe(false);
    for (const path of ["games/a.json.gz", "seasons/2020.json.gz", "postseason/records/2020.json.gz", "advanced/2016/a.json.gz"]) expect(protectedHistoricalPath(path)).toBe(true);
  });
  it("generates Team/chronology projections before immutable reuse and Recent fingerprints", () => {
    const workflow = parse(readFileSync(".github/workflows/mlb-historical-publish.yml", "utf8"));
    const run: string = workflow.jobs.stage.steps.find((s: { name?: string }) => s.name === "Stage compressed Historical payload and preservation archive").run;
    const stage = run.lastIndexOf("stage-mlb-historical.ts"), derived = run.indexOf("generate-historical-team-hubs.ts"), preserve = run.indexOf("preserve-verified-mlb-baseline.ts"), recent = run.indexOf("generate-mlb-recent-explorer.ts");
    expect(stage).toBeGreaterThan(-1); expect(derived).toBeGreaterThan(stage); expect(preserve).toBeGreaterThan(derived); expect(recent).toBeGreaterThan(preserve);
  });
  it.each(["regular", "postseason"] as const)("keeps decade years and %s scope when opening a record leader", competition => {
    const playerId = "mlb:player:00000000-0000-5000-8000-000000000001";
    const base = { playerId, season: 2025, competition, role: "pitching", metric: "SO" };
    const route = mlbRecordPlayerRoute({ ...base, period: { id: "decade-2010", seasons: [2016, 2017, 2018, 2019] } });
    expect(route.startsWith("/MLB/season-compare?")).toBe(true);
    const query = new URLSearchParams(route.split("?")[1]);
    expect(query.get("entity")).toBe(playerId); expect(query.get("years")).toBe("2016,2017,2018,2019"); expect(query.get("competition")).toBe(competition); expect(query.get("role")).toBe("pitching"); expect(query.get("metric")).toBe("SO");
    expect(mlbRecordPlayerRoute({ ...base, period: { id: "range", seasons: [2016, 2025] } })).toBe(`/MLB/players/${encodeURIComponent(playerId)}/stats?competition=${competition}`);
    expect(mlbRecordPlayerRoute(base)).toContain("season=2025");
  });
});
