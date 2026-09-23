import { describe, expect, it } from "vitest";
import mlb from "../public/data/mlb.json";
import npb from "../public/data/npb.json";
import { metrics } from "../src/domain/metrics";
import { normalizeSample } from "../src/infrastructure/providers/sample-provider";
import {
  formatDate, formatDateTime, formatDistance, formatHeight, formatInning,
  formatMetric, formatPitchType, formatPlayerName, formatPositions,
  formatSample, formatSampleWarning, formatTeamName, formatTopPercentile,
  formatVelocity, formatWeight,
} from "../src/presentation/formatters";

describe("Japanese presentation", () => {
  it("keeps source units intact and converts only for display", () => {
    const mph = 98.4;
    expect(formatVelocity(mph, "mph")).toBe("158.4 km/h");
    expect(formatVelocity(mph, "mph", true)).toBe("158.4 km/h（98.4 mph）");
    expect(mph).toBe(98.4);
    expect(formatDistance(400, "ft")).toBe("121.9 m");
    expect(formatHeight(72, "in")).toBe("183 cm");
    expect(formatWeight(220, "lb")).toBe("99.8 kg");
    expect(formatVelocity(Number.NaN, "mph")).toBe("—");
  });

  it("uses JST for instants and does not shift date-only values", () => {
    expect(formatDateTime("2026-09-22T23:00:00Z")).toBe("2026年9月23日 08:00");
    expect(formatDate("2026-09-23")).toBe("2026年9月23日");
    expect(formatDate("2026-09-23", true)).toBe("9月23日");
    expect(formatDate("2026-02-30")).toBe("—");
    expect(formatInning(7, "top")).toBe("7回表");
    expect(formatInning(9, "bottom")).toBe("9回裏");
  });

  it("uses compact positions and explicit detailed names", () => {
    expect(formatPositions(["P", "DH"])).toBe("P / DH");
    expect(formatPositions(["P", "DH"], true)).toBe("P 投手 / DH 指名打者");
    expect(formatPitchType("fourSeam")).toBe("フォーシーム");
    expect(formatPitchType("splitter")).toBe("スプリット");
    expect(formatPitchType(null)).toBe("球種不明");
  });

  it("does not derive unverified Japanese MLB names from search aliases", () => {
    const npbCatalog = normalizeSample(npb, "NPB");
    const mlbCatalog = normalizeSample(mlb, "MLB");
    expect(formatPlayerName(npbCatalog.profiles[0]!.player)).toBe("青葉 蒼");
    expect(formatPlayerName(mlbCatalog.profiles[0]!.player)).toBe("Alex Sample");
    expect(mlbCatalog.profiles[0]!.player.names.japanese).toBeNull();
    expect(formatTeamName(npbCatalog.teams[0])).toBe("青葉クラブ（架空）");
    expect(formatPositions(mlbCatalog.profiles[1]!.player.positions)).toBe("P");
  });

  it("keeps missing distinct from zero and uses metric-specific precision", () => {
    expect(formatMetric({ status: "available", value: 0 }, metrics.avg!)).toBe(".000");
    expect(formatMetric({ status: "available", value: 2.345 }, metrics.era!)).toBe("2.35");
    expect(formatMetric({ status: "available", value: 0.182 }, metrics.barrelPct!)).toBe("18.2%");
    expect(formatMetric({ status: "available", value: Number.NaN }, metrics.avg!)).toBe("—");
    expect(formatMetric({ status: "missing", reason: "未提供" }, metrics.avg!)).toBe("—");
  });

  it("shows sample context briefly and refuses ambiguous percentiles", () => {
    expect(formatSample({ PA: 23 }, "PA")).toBe("23打席");
    expect(formatSample({}, "PA")).toBe("母数不明");
    expect(formatSampleWarning("サンプルが少ないため参考値")).toBe("参考値");
    expect(formatSampleWarning("母数が不明のため評価できません")).toBe("母数不明");
    expect(formatTopPercentile(92, metrics.barrelPct!, "MLB")).toBe("MLB 上位8%");
    expect(formatTopPercentile(92, metrics.avg!, "MLB")).toBeNull();
    expect(formatTopPercentile(8, {
      ...metrics.era!, percentileBasis: "raw-value", higherIsBetter: false,
    }, "MLB")).toBe("MLB 上位8%");
  });
});
