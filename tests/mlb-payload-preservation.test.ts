import { describe, expect, it } from "vitest";
import { equivalentHistoricalPayload, protectedHistoricalPath } from "../scripts/lib/mlb-payload-preservation";

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
});
