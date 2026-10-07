import { describe, expect, it } from "vitest";
import { buildBattingTrends, buildPitchingTrends, rollingBatting, type TrendBatting } from "../src/domain/player-trends";
import { compareIds, npbCompareSection, historicalCompareRoles } from "../src/domain/player-compare";
import type { PlayerAnalysisBundle } from "../src/domain/player-analysis-bundle";
import { buildHistoricalTeamHub } from "../src/data/mlb-team-product";
import type { HistoricalBatter, HistoricalGame, HistoricalPitcher } from "../src/data/mlb-historical";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import { historicalRouteCompetition } from "../src/ui/historical-competition-context";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const bat = (n: number, values: Partial<TrendBatting> = {}): TrendBatting => ({ gameId: `g${n}`, date: `2025-09-${String(n).padStart(2, "0")}`, gameNumber: 1, pa: 4, ab: 4, hits: 1, doubles: 0, triples: 0, homeRuns: 0, walks: 0, hbp: 0, sacrificeFlies: 0, ...values });
it("classifies comparison search roles without excluding two-way or unknown-position players", () => {
  expect(historicalCompareRoles(["P"])).toEqual({ batting: false, pitching: true });
  expect(historicalCompareRoles(["DH", "P"])).toEqual({ batting: true, pitching: true });
  expect(historicalCompareRoles(["1B"])).toEqual({ batting: true, pitching: false });
  expect(historicalCompareRoles([])).toEqual({ batting: true, pitching: true });
});
describe("observed appearance trends", () => {
  it("does not mutate records and orders oldest to newest", () => { const rows = [bat(3), bat(1), bat(2)], before = JSON.stringify(rows); expect(buildBattingTrends(rows, 5, true).rows.map(r => r.gameId)).toEqual(["g1", "g2", "g3"]); expect(JSON.stringify(rows)).toBe(before); });
  it("counts the tail, stops at a known zero and preserves lower bound", () => { expect(buildBattingTrends([bat(1, { hits: 0 }), bat(2), bat(3)], 5, true).hitting).toEqual({ count: 2, atLeast: false }); expect(buildBattingTrends([bat(1), bat(2)], 5, true).hitting).toEqual({ count: 2, atLeast: true }); });
  it("uses H+BB+HBP for on-base rather than PA or errors", () => { const result = buildBattingTrends([bat(1, { hits: 0 }), bat(2, { hits: 0, walks: 1 }), bat(3, { hits: 0, hbp: 1 })], 5, true); expect(result.hitting.count).toBe(0); expect(result.onBase.count).toBe(2); });
  it("has separate HR and hit streaks", () => { const r = buildBattingTrends([bat(1), bat(2, { homeRuns: 1 })], 5, true); expect(r.homeRuns.count).toBe(1); expect(r.hitting.count).toBe(2); });
  it("excludes confirmed zero PA substitutes", () => { expect(buildBattingTrends([bat(1), bat(2, { pa: 0, hits: 0 })], 5, true).hitting.count).toBe(1); });
  it.each(["pa", "hits", "walks", "hbp"] as const)("does not assert on-base through missing %s", field => { expect(buildBattingTrends([bat(1), bat(2, { [field]: null })], 5, true).onBase.count).toBeNull(); });
  it("does not assert streaks through partial Coverage", () => { expect(buildBattingTrends([bat(1), bat(2)], 5, false).hitting.count).toBeNull(); expect(buildPitchingTrends([{ gameId: "g1", date: "2025-01-01", gameNumber: 0, outsRecorded: 0, runs: 0, earnedRuns: 0, strikeouts: 0 }], false).scoreless.count).toBeNull(); });
  it("distinguishes doubleheader order and rejects unknown/duplicate order", () => { const rows = [bat(1, { gameId: "second", gameNumber: 2, hits: 0 }), bat(1, { gameId: "first", gameNumber: 1 })]; expect(buildBattingTrends(rows, 5, true).hitting.count).toBe(0); expect(buildBattingTrends(rows.map(r => ({ ...r, gameNumber: null })), 5, true).ordered).toBe(false); expect(buildBattingTrends([bat(1), bat(1)], 5, true).ordered).toBe(false); });
  it("calculates weighted rolling rates, not average game rates", () => { const m = rollingBatting([bat(1, { pa: 1, ab: 1, hits: 1 }), bat(2, { ab: 4, hits: 0 })]); expect(m.AVG).toBe(.2); expect(m.OPS).toBe(.4); });
  it("requires a full window before charting a rolling point", () => { const r = buildBattingTrends(Array.from({ length: 6 }, (_, i) => bat(i + 1)), 5, true); expect(r.points.map(p => p.fullWindow)).toEqual([false, false, false, false, true, true]); expect(r.recent.G).toBe(5); });
  it("retains nullable rates and known zero counts", () => { expect(rollingBatting([bat(1, { doubles: null })]).OPS).toBeNull(); expect(rollingBatting([bat(1, { ab: 0, hits: 0 })]).AVG).toBeNull(); expect(rollingBatting([bat(1, { hits: 0 })]).H).toBe(0); });
  it("defines scoreless from R, never ER, and includes zero outs", () => { const r = buildPitchingTrends([{ gameId: "g1", date: "2025-01-01", gameNumber: 0, outsRecorded: 3, runs: 1, earnedRuns: 0, strikeouts: 1 }, { gameId: "g2", date: "2025-01-02", gameNumber: 0, outsRecorded: 0, runs: 0, earnedRuns: 0, strikeouts: 0 }], true); expect(r.scoreless.count).toBe(1); expect(r.points[1]!.ERA).toBeNull(); });
});
describe("comparison boundaries", () => {
  it("limits unique canonical IDs to four and isolates leagues", () => { const ids = Array.from({ length: 5 }, (_, i) => uuid(i)); expect(compareIds("NPB", [...ids, ids[0], "same name", `mlb:player:${ids[0]}`].join(","))).toEqual(ids.slice(0, 4)); expect(compareIds("MLB", ids.join(","))).toEqual([]); });
  it("handles unavailable bundle sections without manufacturing totals", () => { const bundle: PlayerAnalysisBundle = { playerId: uuid(1), asOfDate: "2026-10-02", comparison: { status: "error" }, homeAway: { status: "error" }, opponent: { status: "error" }, battingOrder: { status: "error" }, pitcherRole: { status: "error" }, batterRole: { status: "error" } }; expect(npbCompareSection(bundle, "batting", "home", "")).toBeNull(); expect(npbCompareSection(bundle, "pitching", "starter", "")).toBeNull(); });
  it("preserves postseason in new route contexts and native Back", () => { expect(historicalRouteCompetition("/MLB/compare", "?competition=postseason")).toBe("postseason"); expect(historicalRouteCompetition("/MLB/teams/a", "?competition=postseason")).toBe("postseason"); expect(parentNativeRoute(`/MLB/teams/${uuid(1)}?competition=postseason&season=2025`)).toBe("/MLB/teams?competition=postseason&season=2025"); });
  it("uses canonical native team/trends deep links", () => { expect(canonicalDeepLink(`baseballnotes://MLB/teams/mlb:team:${uuid(1)}?season=2025`)).toBe(`/MLB/teams/mlb%3Ateam%3A${uuid(1)}?season=2025`); expect(canonicalDeepLink(`baseballnotes://NPB/players/${uuid(1)}/trends`)).toBe(`/NPB/players/${uuid(1)}/trends`); });
});
const team = `mlb:team:${uuid(1)}`, other = `mlb:team:${uuid(2)}`, player = `mlb:player:${uuid(3)}`;
const batter: HistoricalBatter = { playerId: player, teamId: team, battingOrder: 1, appearanceOrder: 1, starter: true, pa: 4, ab: 4, runs: 1, hits: 2, doubles: 0, triples: 0, homeRuns: 1, rbi: 1, bb: 0, hbp: 0, sh: 0, sf: 0, so: 1, sb: 0, cs: 0 };
const pitcher: HistoricalPitcher = { playerId: player, teamId: team, role: "starter", appearanceOrder: 1, outsRecorded: 27, bf: 30, hits: 2, homeRuns: 0, bb: 0, hbp: 0, so: 10, runs: 0, er: 0, win: true, loss: false, save: false, hold: null, pitchCount: null };
const game: HistoricalGame = { id: `mlb:game:${uuid(4)}`, season: 2025, date: "2025-09-01", homeTeamId: team, awayTeamId: other, homeRuns: 1, awayRuns: 0, innings: 9, number: 0, batting: [batter], pitching: [pitcher], validationIssues: [] };
const input = { teamId: team, season: 2025, competitionType: "regular" as const, coverage: "complete" as const, effectiveDate: "2025-09-28" };
describe("historical team projection", () => {
  it("derives calendar windows and home/away from actual Games while preserving original summaries", () => {
    const recent = { ...game, id: `mlb:game:${uuid(8)}`, date: "2025-09-28" }, away = { ...game, id: `mlb:game:${uuid(9)}`, date: "2025-09-20", homeTeamId: other, awayTeamId: team, homeRuns: 4, awayRuns: 2 };
    const source = [game, recent, away], before = JSON.stringify(source), hub = buildHistoricalTeamHub(source, new Map(), input);
    expect(hub.G).toBe(3); expect(hub.comparisonViews!["7"].G).toBe(1); expect(hub.comparisonViews!["14"].G).toBe(2); expect(hub.comparisonViews!["30"].G).toBe(3);
    expect(hub.comparisonViews!.home.G).toBe(2); expect(hub.comparisonViews!.away.L).toBe(1); expect(hub.comparisonViews!.away.runsFor).toBe(2); expect(hub.comparisonViews!["7"].batting.H!.value).toBe(2); expect(hub.comparisonViews!["7"].pitching.SO!.value).toBe(10); expect(JSON.stringify(source)).toBe(before);
    expect(validStaticPayload(`teams/2025/${team.replaceAll(":", "_")}.json`, { ...hub, comparisonViews: { ...hub.comparisonViews, home: { ...hub.comparisonViews!.home, to: "2025-09-27" } } })).toBe(false);
  });
  it("keeps different players' batting and independent pitching decisions separate", () => {
    const second = `mlb:player:${uuid(7)}`;
    const multiple = { ...game, batting: [batter, { ...batter, playerId: second, hits: 1, homeRuns: 0 }], pitching: [pitcher, { ...pitcher, playerId: second, role: "reliever" as const, outsRecorded: 3, so: 2, win: false, save: true }] };
    const hub = buildHistoricalTeamHub([multiple], new Map(), input);
    const first = hub.players.find(r => r.playerId === player)!, next = hub.players.find(r => r.playerId === second)!;
    expect(hub.batting.H!.value).toBe(3);
    expect(first.batting!.H!.value).toBe(2); expect(next.batting!.H!.value).toBe(1);
    expect(first.pitching!.SO!.value).toBe(10); expect(next.pitching!.SO!.value).toBe(2);
    expect(first.pitching!.W!.value).toBe(1); expect(next.pitching!.W!.value).toBe(0);
    expect(first.pitching!.SV!.value).toBe(0); expect(next.pitching!.SV!.value).toBe(1);
  });
  it("separates a traded player's actual team Facts", () => { const trade = { ...game, id: `mlb:game:${uuid(5)}`, batting: [{ ...batter, teamId: other, hits: 3 }], pitching: [] }; const hub = buildHistoricalTeamHub([game, trade], new Map([[player, "選手"]]), input); expect(hub.players[0]!.batting!.H!.value).toBe(2); expect(hub.batting.H!.value).toBe(2); });
  it("separates regular and postseason while preserving source Games", () => { const post = { ...game, id: `mlb:game:${uuid(6)}`, competitionType: "postseason" as const }; const original = JSON.stringify([game, post]); const regular = buildHistoricalTeamHub([game, post], new Map(), input); const postseason = buildHistoricalTeamHub([game, post], new Map(), { ...input, competitionType: "postseason" }); expect(regular.G).toBe(1); expect(postseason.G).toBe(1); expect(JSON.stringify([game, post])).toBe(original); });
  it("handles empty scope and nullable pitchCount without zeros", () => { const hub = buildHistoricalTeamHub([game], new Map(), input); expect(hub.pitching.pitchCount!.value).toBeNull(); expect(buildHistoricalTeamHub([], new Map(), input).batting.H!.value).toBeNull(); });
  it("validates identity and competition from the requested public path", () => { const hub = buildHistoricalTeamHub([game], new Map(), input), path = `teams/2025/${team.replaceAll(":", "_")}.json`; expect(validStaticPayload(path, hub)).toBe(true); expect(validStaticPayload(path.replace("2025", "2024"), hub)).toBe(false); expect(validStaticPayload(`postseason/${path}`, hub)).toBe(false); expect(validStaticPayload(path, { ...hub, G: 0 })).toBe(false); });
  it("orders latest doubleheader games without a synthetic official rank", () => { const second = { ...game, id: `mlb:game:${uuid(5)}`, number: 2 }, first = { ...game, number: 1 }; const hub = buildHistoricalTeamHub([first, second], new Map(), input); expect(hub.games.map(g => g.number)).toEqual([2, 1]); expect(hub).not.toHaveProperty("rank"); });
});
