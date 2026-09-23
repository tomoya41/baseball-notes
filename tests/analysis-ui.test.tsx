import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import mlb from "../public/data/mlb.json";
import npb from "../public/data/npb.json";
import { foundationAnalysisCapabilities, samplePolicy } from "../src/app/analysis-policy";
import { requiredCapabilities } from "../src/domain/analysis-query";
import { analysisQuerySchema, analysisResultSchema, gameSituationSchema } from "../src/domain/analysis";
import type { AnalysisQuery, AnalysisResult, Split } from "../src/domain/analysis";
import {
  analysisFilters, formatFilterSummary, formatMetricDelta, formatSplitMetric,
  makeAnalysisQuery, splitWarning, visibleSplitRows,
} from "../src/presentation/analysis";
import { normalizeSample } from "../src/infrastructure/providers/sample-provider";
import { UnavailableAnalysisProvider } from "../src/infrastructure/providers/unavailable-analysis-provider";
import { AnalysisDataView, AnalysisScreen } from "../src/ui/analysis";

const now = Date.parse("2026-09-24T03:00:00Z");
const manifest = foundationAnalysisCapabilities("MLB");
function base() {
  return makeAnalysisQuery({ league: "MLB", playerId: "batter-1", subject: "batter", category: "situation",
    situation: "batting-order", countMode: "reached", period: { kind: "season", year: 2026 },
    filters: analysisFilters, manifest, now });
}
function dataResult(query: AnalysisQuery, splits: Split[]): Extract<AnalysisResult, { status: "data" }> {
  const cutoff = new Date(Date.parse(`${query.asOfDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const result = analysisResultSchema.parse({ status: "data", query, splits,
    source: { providerId: "test", label: "テスト専用", kind: "sample", license: "test",
      revision: "1", updatedAt: "2026-09-24T00:00:00Z" },
    aggregationVersion: "1", aggregatedAt: "2026-09-24T01:00:00Z",
    coverage: { startDate: "2026-01-01", endDate: cutoff, completeThrough: cutoff,
      timeZone: query.timeZone, completeness: "complete" },
    freshness: { fetchedAt: "2026-09-24T01:00:00Z", expiresAt: "2026-09-25T01:00:00Z",
      state: "fresh", origin: "provider" }, coordinates: null, warnings: [],
  });
  if (result.status !== "data") throw new Error("Test result was not data");
  return result;
}

describe("Analysis UI contracts", () => {
  it("keeps batting order, PA-start score, game inning and appearance inning separate", () => {
    const query = base();
    expect(query.version).toBe(2);
    expect(requiredCapabilities(query)).toContain("battingOrderSplit");
    const changed = { ...query, filters: { ...query.filters, battingOrder: 3,
      scoreDifferential: { kind: "bucket" as const, value: "tied" as const },
      gameInning: { from: 7, through: 9 }, } };
    expect(analysisQuerySchema.safeParse(changed).success).toBe(true);
    expect(requiredCapabilities(changed)).toEqual(expect.arrayContaining([
      "battingOrderSplit", "scoreDifferentialSplit", "gameInningSplit",
    ]));
    expect(formatFilterSummary(changed.period, changed.filters)).toContain("条件3件");
    expect(analysisQuerySchema.safeParse({ ...changed, filters: { ...changed.filters, appearanceInning: { from: 2, through: 2 } } }).success).toBe(false);
    expect(analysisQuerySchema.safeParse({ ...query, version: 1 }).success).toBe(false);
  });
  it("treats the pitcher's second appearance inning as independent of game inning and times through order", () => {
    const query = makeAnalysisQuery({ league: "MLB", playerId: "pitcher-1", subject: "pitcher", category: "situation",
      situation: "appearance-inning", countMode: "pitch", period: { kind: "season", year: 2026 },
      filters: { ...analysisFilters, gameInning: { from: 8, through: 8 },
        appearanceInning: { from: 2, through: 2 } }, manifest, now });
    expect(requiredCapabilities(query)).toEqual(expect.arrayContaining(["gameInningSplit", "appearanceInningSplit"]));
    expect(query.filters.gameInning?.from).toBe(8);
    expect(query.filters.appearanceInning?.from).toBe(2);
    expect(requiredCapabilities(query)).not.toContain("pitchMix");
    expect(gameSituationSchema.parse({ gameInning: 8, appearanceInning: 2, battingOrder: 3,
      scoreDifferentialRuns: 0, scorePerspective: "pitching-team", observedAt: "plate-appearance-start" }))
      .toMatchObject({ gameInning: 8, appearanceInning: 2 });
    expect(gameSituationSchema.safeParse({ gameInning: 8, appearanceInning: 2,
      timesThroughOrder: 2, battingOrder: 3, scoreDifferentialRuns: 0,
      scorePerspective: "pitching-team", observedAt: "plate-appearance-start" }).success).toBe(false);
  });
  it("keeps count populations explicit, formats velocity and percentage-point deltas", () => {
    const reached = makeAnalysisQuery({ league: "MLB", playerId: "batter-1", subject: "batter", category: "count",
      situation: "handedness", countMode: "reached", period: { kind: "season", year: 2026 },
      filters: analysisFilters, manifest, now });
    const pitch = makeAnalysisQuery({ league: "MLB", playerId: "batter-1", subject: "batter", category: "count",
      situation: "handedness", countMode: "pitch", period: { kind: "season", year: 2026 },
      filters: analysisFilters, manifest, now });
    expect(reached.population).toBe("plate-appearance-reached-count");
    expect(pitch.population).toBe("pitch-at-count");
    expect(formatSplitMetric({ definitionId: "avgVelocity", definitionVersion: "1",
      value: { status: "available", value: 98.4 }, sourceUnit: "mph",
      denominator: { unit: "pitches", count: 80, population: "pitches" } })).toBe("158.4 km/h");
    expect(formatMetricDelta(0.062, "hardHitPct")).toBe("+6.2pt");
    expect(formatMetricDelta(-1.2, "avgVelocity", "mph")).toBe("−1.9 km/h");
    expect(formatSplitMetric({ definitionId: "horizontalMovement", definitionVersion: "1",
      value: { status: "available", value: -5 }, sourceUnit: "in",
      denominator: { unit: "pitches", count: 80, population: "pitches" } })).toBe("-12.7 cm");
    expect(formatSplitMetric({ definitionId: "avgVelocity", definitionVersion: "1",
      value: { status: "available", value: 98.4 },
      denominator: { unit: "pitches", count: 80, population: "pitches" } })).toBe("—");
    expect(formatFilterSummary({ kind: "season", year: 2026 }, {
      ...analysisFilters, gameInning: { from: 7, through: 9 },
    })).toBe("2026年 × 7〜9回");
  });
  it("marks granular small samples without hiding the numeric value", () => {
    const split = { key: "tied", label: "同点", sampleSize: { PA: 3 }, metrics: [], warnings: [] };
    expect(splitWarning(split, "batter", "score-differential", samplePolicy)).toContain("参考値");
    expect(splitWarning({ ...split, sampleSize: { PA: 20 } }, "batter", "score-differential", samplePolicy)).toBeNull();
    expect(splitWarning({ ...split, sampleSize: { appearances: 2 } }, "pitcher", "appearance-inning", samplePolicy)).toContain("参考値");
  });
  it("renders a licensed-provider-shaped arsenal bar, converted velocity, sample and safe relative context", () => {
    const query = makeAnalysisQuery({ league: "MLB", playerId: "pitcher-1", subject: "pitcher", category: "pitch",
      situation: "handedness", countMode: "pitch", period: { kind: "season", year: 2026 },
      filters: analysisFilters, manifest, now });
    const result = dataResult(query, [{ key: "fourSeam", label: "フォーシーム", sampleSize: { pitches: 80 },
      warnings: [], metrics: [
        { definitionId: "usagePct", definitionVersion: "1", value: { status: "available", value: .42 },
          denominator: { unit: "pitches", count: 80, population: "全投球" } },
        { definitionId: "avgVelocity", definitionVersion: "1", value: { status: "available", value: 98.4 },
          sourceUnit: "mph", denominator: { unit: "pitches", count: 80, population: "フォーシーム" } },
      ] }]);
    const html = renderToStaticMarkup(<AnalysisDataView result={result} category="pitch" subject="pitcher" league="MLB" />);
    expect(html).toContain("フォーシーム");
    expect(html).toContain("42.0%");
    expect(html).toContain("80球");
    expect(html).toContain("158.4 km/h");
    const batterResult = dataResult({ ...query, subject: { kind: "batter", playerId: "batter-1" }, groupBy: "none",
      population: "plate-appearances" }, [{ key: "all", label: "打球の特徴", sampleSize: { BBE: 40 },
        warnings: [], metrics: [{ definitionId: "barrelPct", definitionVersion: "1",
          value: { status: "available", value: .182 },
          denominator: { unit: "BBE", count: 40, population: "計測打球" },
          comparison: { population: "MLB打者", season: 2026, sampleSize: { BBE: 500 },
            leagueAverage: .1, percentile: 92 } }] }]);
    const batterHtml = renderToStaticMarkup(<AnalysisDataView result={batterResult} category="summary" subject="batter" league="MLB" />);
    expect(batterHtml).toContain("MLB 上位8%");
  });
  it("shows tied-score small sample and keeps late game innings behind compact bands", () => {
    const query = { ...base(), groupBy: "score-differential" as const };
    const split: Split = { key: "tied", label: "同点", sampleSize: { PA: 3 }, warnings: [],
      metrics: [{ definitionId: "avg", definitionVersion: "1", value: { status: "available", value: 2 / 3 },
        denominator: { unit: "AB", count: 3, population: "同点の打数" } }] };
    const html = renderToStaticMarkup(<AnalysisDataView result={dataResult(query, [split])}
      category="situation" subject="batter" league="MLB" />);
    expect(html).toContain("同点");
    expect(html).toContain(".667");
    expect(html).toContain("参考値");
    const innings = ["band:1-3", "band:4-6", "band:7-9", "inning:8"].map((key) => ({ ...split, key, label: key }));
    expect(visibleSplitRows(innings, "game-inning", false).map((row) => row.key)).toEqual([
      "band:1-3", "band:4-6", "band:7-9",
    ]);
    expect(visibleSplitRows(innings, "game-inning", true)).toHaveLength(4);
    const counts = ["first-pitch", "pitcher-ahead", "batter-ahead", "two-strikes", "full-count", "0-0", "0-1"]
      .map((key) => ({ ...split, key, label: key }));
    expect(visibleSplitRows(counts, "count", false)).toHaveLength(5);
    expect(visibleSplitRows(counts, "count", true)).toHaveLength(7);
  });
  it.each([
    ["NPB", npb, "aoi", "打者分析"], ["NPB", npb, "ren", "投手分析"],
    ["MLB", mlb, "alex", "打者分析"], ["MLB", mlb, "casey", "打者分析"],
  ] as const)("shows honest unavailable state for %s %s", (league, data, id, label) => {
    const catalog = normalizeSample(data, league);
    const player = catalog.profiles.find((profile) => profile.player.id.endsWith(`:${id}`))!.player;
    const html = renderToStaticMarkup(<AnalysisScreen catalog={catalog} player={player}
      provider={new UnavailableAnalysisProvider(foundationAnalysisCapabilities)} />);
    expect(html).toContain(label);
    expect(html).toContain("この条件の分析データはありません");
    expect(html).not.toContain("xwOBA .");
    if (id === "casey") expect(html).toContain("分析対象");
  });
});
