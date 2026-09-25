import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerRecentView } from "../src/ui/player-recent";
import { formatRecentMetric } from "../src/presentation/recent-formatter";
import { aggregateBatting, aggregatePitching } from "../src/domain/player-period";
import type { PlayerGameBatting, PlayerGamePitching } from "../src/domain/game-facts";
import type { PlayerRecentResponse } from "../src/domain/player-recent";
import { HttpPlayerRecentRepository } from "../src/infrastructure/providers/http-player-recent-repository";

const common = { gameId: "game-1", playerId: "06a3e027-7a73-4792-9c91-8ecc3c1da36a", teamId: "team",
  opponentTeamId: "other", sourceKey: "nf3", sourceRecordId: "row", collectedAt: "2026-09-25T00:00:00.000Z" };
const batting: PlayerGameBatting = { ...common, battingOrder: 3, pa: 5, ab: 4, hits: 2, doubles: 0, triples: 0,
  homeRuns: 0, rbi: 1, walks: 1, strikeouts: 1, hbp: 0, stolenBases: null, caughtStealing: null,
  sacrificeHits: 0, sacrificeFlies: 0, runs: 1, starter: true };
const pitching: PlayerGamePitching = { ...common, id: "pitch-1", role: "reliever", appearanceOrder: null,
  inningsPitchedOuts: 4, battersFaced: 6, hits: 2, homeRuns: 0, walks: null, hitBatters: null,
  walksAndHitBatters: 1, strikeouts: 2, runs: 0, earnedRuns: 0, pitches: 27, catcherId: null,
  starter: false, decision: "none" };
const query = { playerId: common.playerId, asOfDate: "2026-09-24", period: "7d" as const };
const player = { id: common.playerId, name: "中島大輔", teamId: "team", teamName: "楽天" };
const base = { player, asOfDate: query.asOfDate, period: query.period };
const render = (payload: PlayerRecentResponse | null, state: "loading" | "ready" | "missing" | "error" = "ready",
  period: PlayerRecentResponse["period"] = "7d") =>
  renderToStaticMarkup(<PlayerRecentView period={period} onPeriodChange={() => undefined} payload={payload} state={state} />);

describe("Player Recent Form", () => {
  it("shows batter rates, period selector, freshness and unknown coverage without WHIP", () => {
    const result = aggregateBatting(query, [batting]);
    result.coverage.status = "unknown";
    const html = render({ ...base, batting: result, pitching: null });
    expect(html).toContain("直近7日");
    expect(html).toContain("直近14日");
    expect(html).toContain("直近30日");
    expect(html).toContain("今月の成績");
    expect(html).toContain("シーズンの成績");
    expect(html).toContain("9月24日終了時点");
    expect(html).toContain("収集済みデータから算出");
    expect(html).toContain(".500");
    expect(html).not.toContain("WHIP");
  });
  it("offers all five accessible periods and keeps season values visible with unknown coverage", () => {
    const result = aggregateBatting(query, [batting]);
    result.coverage.status = "unknown";
    const payload: PlayerRecentResponse = { ...base, period: "season", batting: result, pitching: null };
    const html = render(payload, "ready", "season");
    for (const label of ["直近7日", "直近14日", "直近30日", "今月の成績", "シーズンの成績"])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain("aria-label=\"シーズンの成績\" aria-pressed=\"true\"");
    expect(html).toContain("収集済みデータから算出");
    expect(html).toContain(".500");
    expect(render({ ...payload, period: "currentMonth" }, "ready", "currentMonth")).toContain("今月");
  });
  it("shows pitcher fractional IP, ERA and K/9; excludes WHIP even if computed", () => {
    const html = render({ ...base, batting: null, pitching: aggregatePitching(query, [pitching]) });
    expect(html).toContain("1.1");
    expect(html).toContain("0.00");
    expect(html).toContain("13.5");
    expect(html).not.toContain("WHIP");
  });
  it("distinguishes no appearance, zero PA, loading, error and all coverage states", () => {
    expect(render({ ...base, batting: null, pitching: null })).toContain("この期間の出場データはありません");
    expect(render(null, "loading")).toContain("skeleton");
    expect(render(null, "error")).toContain("最近の成績を読み込めません");
    const zero = aggregateBatting(query, [{ ...batting, pa: 0, ab: 0, hits: 0, walks: 0 }]);
    expect(render({ ...base, batting: zero, pitching: null })).toContain("0");
    expect(formatRecentMetric("AVG", zero.metrics.AVG)).toBe("—");
    for (const [status, phrase] of [["complete", ""], ["partial", "一部データ未収集"],
      ["unavailable", "収集状況を確認できません"]] as const) {
      zero.coverage.status = status;
      const html = render({ ...base, batting: zero, pitching: null });
      if (phrase) expect(html).toContain(phrase);
      else expect(html).not.toContain("recent-coverage");
    }
  });
  it("validates API payload and never falls back to sample stats", async () => {
    const payload = { ...base, batting: aggregateBatting(query, [batting]), pitching: null };
    const repository = new HttpPlayerRecentRepository("https://example.test/", async () =>
      new Response(JSON.stringify(payload), { status: 200 }));
    expect((await repository.find(common.playerId, "7d"))?.batting?.metrics.H?.value).toBe(2);
    const broken = new HttpPlayerRecentRepository("https://example.test/", async () => new Response("{}", { status: 200 }));
    await expect(broken.find(common.playerId, "7d")).rejects.toThrow();
  });
});
