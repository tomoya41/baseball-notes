import { describe, expect, it } from "vitest";
import npb from "../public/data/npb.json";
import mlb from "../public/data/mlb.json";
import { normalizeSample } from "../src/infrastructure/providers/sample-provider";
import { formatMetric, metrics, ratio } from "../src/domain/metrics";

describe("validation and normalization boundary", () => {
  it("normalizes identities, team relations and statistics before exposing data", () => {
    const catalog = normalizeSample(npb, "NPB");
    expect(catalog.profiles[0]?.player.id).toBe("sample:NPB:player:aoi");
    expect(catalog.statistics[0]?.metrics.avg).toEqual({
      status: "available",
      value: 0.3,
    });
    expect(catalog.source.kind).toBe("sample");
  });
  it.each([
    { ...npb, league: "MLB" },
    { ...npb, updated_at: "yesterday" },
    {
      ...npb,
      players: [
        {
          ...npb.players[0],
          batting: {
            ab: 2,
            hits: 3,
            hr: 1,
            obp: 0.5,
            slg: 1,
            barrelRate: null,
          },
        },
      ],
    },
    { ...npb, players: [{ ...npb.players[0], club: "nonexistent" }] },
    { ...npb, players: [npb.players[0], npb.players[0]] },
    { ...npb, clubs: [npb.clubs[0], npb.clubs[0]] },
    { ...npb, season: "2026" },
  ])("rejects malformed input or broken relations", (wire) => {
    expect(() => normalizeSample(wire, "NPB")).toThrow();
  });
  it("keeps unsupported NPB, missing MLB and real zero distinct", () => {
    const n = normalizeSample(npb, "NPB").statistics[0];
    const m = normalizeSample(mlb, "MLB").statistics;
    expect(n?.metrics.barrelPct?.status).toBe("unsupported");
    expect(m[0]?.metrics.barrelPct).toEqual({
      status: "available",
      value: 0.125,
    });
    expect(m[1]?.metrics.avg?.status).toBe("missing");
    expect(m[1]?.metrics.hr).toEqual({ status: "available", value: 0 });
    expect(m[1]?.metrics.ops?.status).toBe("missing");
    expect(m.filter((s) => s.playerId.endsWith(":casey"))).toHaveLength(2);
  });
});
describe("baseball calculations", () => {
  it("does not divide by zero", () => {
    expect(ratio(0, 0).status).toBe("missing");
  });
  it("calculates ERA using outs, including thirds of an inning", () => {
    const catalog = normalizeSample(mlb, "MLB");
    expect(catalog.statistics[2]?.metrics.era).toEqual({
      status: "available",
      value: 54 / 19,
    });
    expect(
      formatMetric({ status: "available", value: 19 }, metrics.outs!),
    ).toBe("6回 1/3");
  });
  it("formats rate and percent units consistently", () => {
    expect(
      formatMetric({ status: "available", value: 0.125 }, metrics.barrelPct!),
    ).toBe("12.5%");
    expect(
      formatMetric({ status: "available", value: 0.3 }, metrics.avg!),
    ).toBe(".300");
    expect(
      formatMetric({ status: "missing", reason: "missing" }, metrics.avg!),
    ).toBe("—");
  });
});
