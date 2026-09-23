import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import mlb from "../public/data/mlb.json";
import npb from "../public/data/npb.json";
import { foundationAnalysisCapabilities } from "../src/app/analysis-policy";
import { sampleWarning, analysisResultSchema } from "../src/domain/analysis";
import type { AnalysisQuery, AnalysisResult, Split } from "../src/domain/analysis";
import { assessAnalysisQuery, requiredCapabilities } from "../src/domain/analysis-query";
import { bullpenUsageSchema, watchBullpenResultSchema, watchCapabilitiesSchema, watchGameSchema, watchLineupResultSchema, watchLineupSchema } from "../src/domain/watch";
import { normalizeSample } from "../src/infrastructure/providers/sample-provider";
import { UnavailableWatchProvider } from "../src/infrastructure/providers/unavailable-watch-provider";
import { attentionPitch, matchupQuery } from "../src/presentation/matchup";
import { isWatchDay } from "../src/presentation/watch";
import { DirectMatchup, ArsenalVsBatter, MatchupScreen } from "../src/ui/matchup";
import { BullpenView, LineupView, WatchGameSections, WatchToday } from "../src/ui/watch";
import { samplePolicy } from "../src/app/analysis-policy";

const now = Date.parse("2026-09-24T12:00:00Z");
const catalog = normalizeSample(mlb, "MLB");
const pitcherId = "sample:MLB:player:casey";
const batterId = "sample:MLB:player:alex";
function query(section: "direct" | "arsenal" | "count" | "recent", actor?: "pitcher" | "batter") {
  return matchupQuery({ league: "MLB", pitcherId, batterId, section, ...(actor ? { actor } : {}), now });
}
function data(q: AnalysisQuery, splits: Split[]): Extract<AnalysisResult, { status: "data" }> {
  const parsed = analysisResultSchema.parse({ status: "data", query: q, splits,
    source: { providerId: "test", label: "テスト", kind: "sample", license: "fixture", revision: "1",
      updatedAt: "2026-09-24T02:00:00Z" }, aggregationVersion: "1", aggregatedAt: "2026-09-24T02:00:00Z",
    coverage: { startDate: "2026-04-01", endDate: "2026-09-23", completeThrough: "2026-09-23",
      timeZone: q.timeZone, completeness: "complete" },
    freshness: { fetchedAt: "2026-09-24T02:00:00Z", expiresAt: "2026-09-25T02:00:00Z",
      state: "fresh", origin: "provider" }, coordinates: null, warnings: [], });
  if (parsed.status !== "data") throw new Error("fixture invalid");
  return parsed;
}
function metric(definitionId: string, value: number, count: number) {
  return { definitionId, definitionVersion: "1", value: { status: "available" as const, value },
    denominator: { unit: "pitches" as const, count, population: "fixture" } };
}
const pitch: Split = { key: "splitter", label: "スプリット", sampleSize: { pitches: 120 },
  metrics: [metric("usagePct", .31, 120)], warnings: [] };
const against: Split = { key: "splitter", label: "スプリット", sampleSize: { pitches: 87 },
  metrics: [metric("xwoba", .287, 87), metric("whiffPct", .36, 87)], warnings: [] };

describe("MATCHUP contracts and UI", () => {
  it("uses explicit matchup IDs and independent count populations", () => {
    const direct = query("direct");
    expect(direct.subject).toEqual({ kind: "matchup", pitcherId, batterId });
    expect(requiredCapabilities(direct)).toEqual(expect.arrayContaining(["matchup", "directMatchup"]));
    expect(query("count", "pitcher").population).toBe("pitch-at-count");
    expect(query("arsenal", "batter").groupBy).toBe("pitch-type");
    expect(query("recent", "batter").period).toEqual({ kind: "last-days", days: 30 });
  });
  it("keeps NPB pitch-level hidden behind capability and current samples unavailable", () => {
    const npbManifest = foundationAnalysisCapabilities("NPB");
    const npbQuery = matchupQuery({ league: "NPB", pitcherId: "p", batterId: "b", section: "direct", now });
    expect(assessAnalysisQuery(npbQuery, npbManifest).enabled).toBe(false);
    expect(npbManifest.features.pitchTypeMatchup.status).toBe("unavailable");
    expect(foundationAnalysisCapabilities("MLB").features.pitchTypeMatchup.status).toBe("unavailable");
  });
  it("marks four direct PA as reference and leaves adequate samples unlabelled", () => {
    expect(sampleWarning({ PA: 4 }, "directMatchup", samplePolicy)).toContain("参考値");
    expect(sampleWarning({ PA: 25 }, "directMatchup", samplePolicy)).toBeNull();
    const direct = data(query("direct"), [{ key: "all", label: "直接対戦", sampleSize: { PA: 4 },
      metrics: [metric("hits", 2, 4), metric("hr", 1, 4)], warnings: [] }]);
    const html = renderToStaticMarkup(<DirectMatchup result={direct} league="MLB" />);
    expect(html).toContain("4打席");
    expect(html).toContain("参考値");
    expect(html).toContain("安打");
  });
  it("only derives an attention pitch when both sides have enough observations", () => {
    const pitcher = data(query("arsenal", "pitcher"), [pitch]);
    const batter = data(query("arsenal", "batter"), [against]);
    expect(attentionPitch(pitcher, batter)?.pitcher.key).toBe("splitter");
    const sparse = data(query("arsenal", "batter"), [{ ...against, sampleSize: { pitches: 8 } }]);
    expect(attentionPitch(pitcher, sparse)).toBeNull();
    expect(attentionPitch(pitcher, { ...batter, coverage: { ...batter.coverage,
      completeThrough: "2026-09-22", endDate: "2026-09-22" } })).toBeNull();
    const html = renderToStaticMarkup(<ArsenalVsBatter pitcher={pitcher} batter={batter} league="MLB" />);
    expect(html).toContain("スプリット");
    expect(html).toContain("31.0%");
    expect(html).toContain("xwOBA");
  });
  it("shows manual selection without inventing matchup results", () => {
    const provider = { id: "test", capabilities: foundationAnalysisCapabilities,
      analyze: async () => ({ status: "unavailable" as const, reason: "未接続", query: query("direct") }) };
    const html = renderToStaticMarkup(<MemoryRouter><MatchupScreen catalog={catalog} provider={provider} /></MemoryRouter>);
    expect(html).toContain("投手を検索");
    expect(html).toContain("打者を検索");
    expect(html).not.toContain("スプリットに注目");
  });
});

describe("WATCH contracts and UI", () => {
  const game = watchGameSchema.parse({ id: "g1", league: "MLB", gameDate: "2026-09-23",
    startsAt: "2026-09-24T01:00:00Z", homeTeamId: catalog.teams[0]!.id,
    awayTeamId: "opponent", homeStarterId: pitcherId, awayStarterId: null });
  it("maps late US games to the Japanese calendar day", () => {
    expect(isWatchDay(game, "2026-09-24")).toBe(true);
    expect(isWatchDay(game, "2026-09-23")).toBe(false);
  });
  it("validates lineups and separates unconfirmed from confirmed orders", () => {
    const lineup = watchLineupSchema.parse({ gameId: "g1", teamId: "opponent", confirmed: false,
      players: [{ battingOrder: 1, playerId: batterId }, { battingOrder: 2, playerId: pitcherId },
        { battingOrder: 3, playerId: "other-player" }] });
    const html = renderToStaticMarkup(<MemoryRouter><LineupView lineup={lineup} catalog={catalog}
      opposingPitcherId={pitcherId} /></MemoryRouter>);
    expect(html).toContain("予定打順");
    expect(html).toContain("打順から選ぶ3打者");
    expect(html).toContain("MATCHUP");
    expect(watchLineupSchema.safeParse({ ...lineup, players: [lineup.players[0], lineup.players[0]] }).success).toBe(false);
  });
  it("shows bullpen facts without availability or fatigue predictions", () => {
    const usage = bullpenUsageSchema.parse({ gameId: "g1", teamId: catalog.teams[0]!.id,
      completeThrough: "2026-09-23", pitchers: [{ playerId: pitcherId,
        lastAppearanceDate: "2026-09-23", previousDayPitches: 24,
        lastThreeDaysAppearances: 2, consecutiveDays: 2, lastThreeDaysPitches: 42 }] });
    const html = renderToStaticMarkup(<BullpenView usage={usage} catalog={catalog} />);
    expect(html).toContain("前日 24球");
    expect(html).toContain("直近3日 2登板 / 42球");
    expect(html).toContain("2連投");
    expect(html).not.toContain("疲労");
  });
  it("keeps schedule, lineup and bullpen permissions independent", () => {
    const capabilities = new UnavailableWatchProvider().capabilities("NPB");
    expect(watchCapabilitiesSchema.parse(capabilities).schedule.status).toBe("unavailable");
    expect(capabilities.lineup.status).toBe("unavailable");
    const html = renderToStaticMarkup(<MemoryRouter><WatchToday catalog={normalizeSample(npb, "NPB")}
      provider={new UnavailableWatchProvider()} /></MemoryRouter>);
    expect(html).toContain("この提供元にはデータがありません");
    expect(html).toContain("投手と打者を選んで比較");
  });
  it("keeps the lineup visible when bullpen acquisition fails", () => {
    const available = { status: "available" as const, implementation: "implemented" as const,
      reason: "fixture", evidence: ["test"] };
    const capability = watchCapabilitiesSchema.parse({ providerId: "test", league: "MLB",
      schedule: available, lineup: available, bullpenUsage: available });
    const lineup = watchLineupResultSchema.parse({ status: "data", observedAt: "2026-09-24T02:00:00Z",
      source: { providerId: "test", label: "fixture", kind: "sample", license: "fixture", revision: "1",
        updatedAt: "2026-09-24T02:00:00Z" },
      freshness: { fetchedAt: "2026-09-24T02:00:00Z", expiresAt: "2026-09-25T02:00:00Z",
        state: "fresh", origin: "provider" },
      lineup: { gameId: "g1", teamId: "opponent", confirmed: true,
        players: [{ battingOrder: 1, playerId: batterId }] } });
    const html = renderToStaticMarkup(<MemoryRouter><WatchGameSections catalog={catalog} game={game}
      date="2026-09-24" observedAt="2026-09-24T02:00:00Z" capability={capability}
      lineup={{ result: lineup, error: null }} bullpen={{ result: null, error: "通信失敗" }} /></MemoryRouter>);
    expect(html).toContain("発表済み打順");
    expect(html).toContain("Alex Sample");
    expect(html).toContain("通信失敗");
  });
  it("keeps bullpen facts visible when lineup is unavailable", () => {
    const available = { status: "available" as const, implementation: "implemented" as const,
      reason: "fixture", evidence: ["test"] };
    const capability = watchCapabilitiesSchema.parse({ providerId: "test", league: "MLB",
      schedule: available, lineup: available, bullpenUsage: available });
    const bullpen = watchBullpenResultSchema.parse({ status: "data", observedAt: "2026-09-24T02:00:00Z",
      source: { providerId: "test", label: "fixture", kind: "sample", license: "fixture", revision: "1",
        updatedAt: "2026-09-24T02:00:00Z" },
      freshness: { fetchedAt: "2026-09-24T02:00:00Z", expiresAt: "2026-09-25T02:00:00Z",
        state: "fresh", origin: "provider" },
      usage: { gameId: "g1", teamId: catalog.teams[0]!.id, completeThrough: "2026-09-23",
        pitchers: [{ playerId: pitcherId, lastAppearanceDate: "2026-09-23", previousDayPitches: 24,
          lastThreeDaysAppearances: 1, consecutiveDays: 1, lastThreeDaysPitches: 24 }] } });
    const html = renderToStaticMarkup(<MemoryRouter><WatchGameSections catalog={catalog} game={game}
      date="2026-09-24" observedAt="2026-09-24T02:00:00Z" capability={capability}
      lineup={{ result: { status: "unavailable", reason: "打順未取得" }, error: null }}
      bullpen={{ result: bullpen, error: null }} /></MemoryRouter>);
    expect(html).toContain("打順未取得");
    expect(html).toContain("前日 24球");
  });
});
