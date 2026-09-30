import { describe, expect, it } from "vitest";
import { historicalId, historicalTeamId, type HistoricalGame } from "../src/data/mlb-historical";
import { RetrosheetPaParser, validatePaGame, type RetrosheetPlay } from "../src/data/mlb-retrosheet-pa";
import { battingRateQualification, mlbPitchingQualification, pitchingRateQualification, scheduledMlbGames } from "../src/domain/mlb-ranking-qualification";
import { battingAggregate, type DatedBatter } from "../src/domain/mlb-historical-aggregate";
import { situationKeys } from "../src/domain/mlb-plate-appearance";
import { openDataClient } from "../src/data/database";
import { createHistoricalPaTables, replaceHistoricalPaGame } from "../src/data/mlb-pa-repository";
import { exactBvp, historicalAdvancedGate } from "../src/domain/mlb-pa-analysis";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HistoricalAdvancedAnalysis, PaMetricTable } from "../src/ui/mlb-historical-advanced";

const batter = historicalId("player", "b"), pitcher = historicalId("player", "p"), substitute = historicalId("player", "s");
const home = historicalTeamId("LAN"), away = historicalTeamId("CHN");
const game: HistoricalGame = { id: historicalId("game", "fixture"), season: 2025, date: "2025-09-20",
  homeTeamId: home, awayTeamId: away, homeRuns: 0, awayRuns: 0, innings: 9, number: 0, validationIssues: [],
  batting: [batter, substitute].map(playerId => ({ playerId, teamId: away, battingOrder: 1, appearanceOrder: 1, starter: playerId === batter,
    pa: 1, ab: 1, runs: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, rbi: 0, bb: 0, hbp: 0, sh: 0, sf: 0, so: 0, sb: 0, cs: 0 })),
  pitching: [{ playerId: pitcher, teamId: home, role: "starter", appearanceOrder: 1, outsRecorded: 1, bf: 1, hits: 0, homeRuns: 0,
    bb: 0, hbp: 0, so: 0, runs: 0, er: 0, pitchCount: null, win: null, loss: null, save: null, hold: null }] };
const identities = new Map([["b", batter], ["p", pitcher], ["s", substitute]]);
const play = (fields: Partial<RetrosheetPlay> = {}): RetrosheetPlay => ({ gid: "fixture", pn: "1", inning: "1", top_bot: "0", vis_home: "0",
  batteam: "CHN", pitteam: "LAN", batter: "b", pitcher: "p", lp: "1", pa: "1", ab: "1", single: "0", double: "0", triple: "0", hr: "0",
  sh: "0", sf: "0", hbp: "0", walk: "0", k: "0", xi: "0", roe: "0", fc: "0", othout: "1", noout: "0", iw: "0",
  score_v: "0", score_h: "0", outs_pre: "0", outs_post: "1", br1_pre: "", br2_pre: "", br3_pre: "", br1_post: "", br2_post: "", br3_post: "", runs: "0", ...fields });
const parsed = (fields: Partial<RetrosheetPlay> = {}) => new RetrosheetPaParser(game, identities).consume(play(fields))!;

describe("Retrosheet PA flags and explicit identities", () => {
  it.each(["single", "double", "triple", "hr", "walk", "hbp", "k", "roe", "fc", "sh", "sf", "xi"])("parses %s without token inference", category => {
    const pa = parsed({ othout: "0", [category]: "1", ab: ["walk", "hbp", "sh", "sf", "xi"].includes(category) ? "0" : "1" });
    expect(pa.result).toBe(category); expect(pa.batterId).toBe(batter); expect(pa.pitcherId).toBe(pitcher);
  });
  it("keeps intentional walk as a subset of walk", () => {
    const pa = parsed({ othout: "0", walk: "1", iw: "1", ab: "0" });
    expect(pa.walks).toBe(1); expect(pa.intentionalWalks).toBe(1);
    expect(() => parsed({ iw: "1" })).toThrow("IBB");
  });
  it("counts a double-play PA once and excludes runner-only plays", () => {
    const parser = new RetrosheetPaParser(game, identities);
    expect(parser.consume(play({ pa: "0", othout: "0", ab: "0", outs_post: "0", br1_pre: "r", br2_post: "r" }))).toBeNull();
    const pa = parser.consume(play({ pn: "2", outs_post: "2", br2_pre: "r", br2_post: "" }))!;
    expect(pa.sequence).toBe(1); expect(pa.baseStateBefore).toBe(1); // PA-start, before the steal.
  });
  it("allows NP after three outs but never invents a PA", () => {
    const parser = new RetrosheetPaParser(game, identities);
    expect(parser.consume(play({ event: "NP", pa: "0", ab: "0", othout: "0", outs_pre: "3", outs_post: "3" }))).toBeNull();
    expect(() => parsed({ outs_pre: "3", outs_post: "3" })).toThrow("third out");
  });
  it("uses explicit automatic-runner placement after a no-play extra-inning substitution", () => {
    const parser = new RetrosheetPaParser(game, identities);
    parser.consume(play({ inning: "10", event: "NP", pa: "0", ab: "0", othout: "0", outs_post: "0" }));
    const pa = parser.consume(play({ inning: "10", br2_pre: "runner", batter: "s" }))!;
    expect(pa.baseStateBefore).toBe(2); expect(parser.issues).toEqual([]);
  });
  it("nulls uncertain substitution context instead of inferring it", () => {
    const parser = new RetrosheetPaParser(game, identities);
    parser.consume(play({ pa: "0", othout: "0", ab: "0", outs_post: "0" }));
    const pa = parser.consume(play({ pn: "2", batter: "s" }))!;
    expect(pa.batterId).toBe(substitute); expect(pa.substitutionDuringPa).toBe(true); expect(pa.outsBefore).toBeNull();
  });
  it("preserves exact relation across a pitching change", () => {
    const next = historicalId("player", "next");
    const parser = new RetrosheetPaParser({ ...game, pitching: [...game.pitching, { ...game.pitching[0]!, playerId: next, role: "reliever" }] },
      new Map([...identities, ["next", next]]));
    parser.consume(play({ pa: "0", othout: "0", ab: "0", outs_post: "0" }));
    expect(parser.consume(play({ pitcher: "next", pn: "2" }))?.pitcherId).toBe(next);
  });
  it("resets PA context at an extra-inning boundary", () => {
    const parser = new RetrosheetPaParser(game, identities);
    parser.consume(play({ inning: "9", pa: "0", othout: "0", ab: "0", outs_pre: "2", outs_post: "3" }));
    const pa = parser.consume(play({ inning: "10", top_bot: "1", pn: "2", br2_pre: "r" }))!;
    expect(pa.outsBefore).toBe(0); expect(situationKeys(pa)).toContain("inning:extra"); expect(situationKeys(pa)).toContain("bases:risp");
  });
  it("rejects ambiguous, missing and same-name-only identity", () => {
    expect(() => parsed({ single: "1" })).toThrow("Ambiguous");
    expect(() => parsed({ batter: "unmapped" })).toThrow("identity");
    expect(() => parsed({ ab: "" })).toThrow("flag");
  });
  it("validates PA=0 participants without inventing a matchup", () => {
    const only = { ...game, batting: [game.batting[0]!, { ...game.batting[1]!, pa: 0, ab: 0 }] };
    expect(validatePaGame(only, [parsed()])).toEqual([]);
  });
  it("validates a suspended-game player appearing for both teams without pooling team lines", () => {
    const dual = { ...game, batting: [game.batting[0]!, { ...game.batting[0]!, teamId: home, pa: 0, ab: 0 }] };
    expect(validatePaGame(dual, [parsed()])).toEqual([]);
  });
});

describe("situation capability", () => {
  it.each([[0, "empty"], [1, "runners"], [2, "risp"], [4, "risp"]] as const)("maps base mask %i", (mask, expected) => {
    expect(situationKeys({ ...parsed(), baseStateBefore: mask })).toContain(`bases:${expected}`);
  });
  it.each([[1, 0, "ahead"], [0, 0, "tied"], [0, 1, "behind"]] as const)("maps score state", (b, p, expected) => {
    expect(situationKeys({ ...parsed(), battingScoreBefore: b, fieldingScoreBefore: p })).toContain(`score:${expected}`);
  });
  it("unknown situation remains unavailable", () => {
    expect(situationKeys({ ...parsed(), outsBefore: null, baseStateBefore: null, battingScoreBefore: null })).toEqual(["inning:1–3"]);
  });
});

const metrics = (pa: number, ab: number, hits: number) => {
  const row: DatedBatter = { ...game.batting[0]!, gameId: game.id, date: game.date, season: 2025, home: false,
    opponentTeamId: home, pa, ab, hits, bb: pa - ab };
  return battingAggregate(batter, [row], game.date, game.date).metrics;
};
describe("official qualification", () => {
  it("uses ordinary qualification and 2020's revised schedule", () => {
    expect(scheduledMlbGames(2020)).toBe(60); expect(scheduledMlbGames(2026)).toBeNull();
    expect(battingRateQualification(2020, metrics(186, 180, 60), "AVG", true, .3).state).toBe("qualified");
    expect(battingRateQualification(2025, metrics(502, 500, 181), "AVG", true, .3).state).toBe("qualified");
    expect(mlbPitchingQualification(2020, 180)).toBe("qualified"); expect(mlbPitchingQualification(2025, 485)).toBe("unqualified");
  });
  it("matches the Rule 9.22 comment example without mutating Facts", () => {
    const before = metrics(490, 440, 165), snapshot = JSON.stringify(before);
    const result = battingRateQualification(2025, before, "AVG", true, 181 / 500);
    expect(result.state).toBe("qualified_by_exception"); expect(result.adjustedValue).toBe(165 / 452); expect(result.missingPa).toBe(12);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
  it("evaluates OBP/SLG independently and never copies the exception to OPS", () => {
    const line = metrics(490, 440, 165);
    expect(battingRateQualification(2025, line, "AVG", true, .4).state).toBe("unqualified");
    expect(battingRateQualification(2025, line, "OBP", true, .3).state).toBe("qualified_by_exception");
    expect(battingRateQualification(2025, line, "SLG", true, .3).state).toBe("qualified_by_exception");
    expect(battingRateQualification(2025, line, "OPS", true, .3).state).toBe("unqualified");
  });
  it("missing Coverage, metric, denominator or title comparator stays unknown", () => {
    expect(battingRateQualification(2025, metrics(490, 440, 165), "AVG", false, .3).state).toBe("unknown");
    expect(battingRateQualification(2025, metrics(490, 440, 165), "AVG", true, null).state).toBe("unknown");
    expect(battingRateQualification(2026, metrics(502, 500, 181), "AVG", true, .3).state).toBe("unknown");
    const incomplete = metrics(502, 500, 181); incomplete.H = { ...incomplete.H, value: null, status: "unavailable" };
    incomplete.AVG = { ...incomplete.AVG, value: null, status: "unavailable" };
    expect(battingRateQualification(2025, incomplete, "AVG", true, .3).state).toBe("unknown");
  });
  it("only the highest adjusted exception candidate remains eligible", () => {
    const a = metrics(490, 440, 165), b = metrics(490, 440, 170);
    const leader = Math.max(.362, battingRateQualification(2025, a, "AVG", true, .362).adjustedValue!,
      battingRateQualification(2025, b, "AVG", true, .362).adjustedValue!);
    expect(battingRateQualification(2025, a, "AVG", true, leader).state).toBe("unqualified");
    expect(battingRateQualification(2025, b, "AVG", true, leader).state).toBe("qualified_by_exception");
  });
  it("requires a complete pitcher rate and never qualifies zero outs", () => {
    const line = { outsRecorded: { value: 180, status: "complete" as const, observedFacts: 1, factCount: 1 },
      ERA: { value: 2, status: "complete" as const, observedFacts: 1, factCount: 1 } };
    expect(pitchingRateQualification(2020, line, "ERA", true)).toBe("qualified");
    expect(pitchingRateQualification(2021, line, "ERA", true)).toBe("unqualified");
    expect(pitchingRateQualification(2020, { ...line, ERA: { ...line.ERA, value: null, status: "unavailable" } }, "ERA", true)).toBe("unknown");
    expect(pitchingRateQualification(2020, { ...line, outsRecorded: { ...line.outsRecorded, value: 0 } }, "ERA", true)).toBe("unqualified");
  });
});

it("PA persistence is idempotent and corrections atomically remove obsolete rows", async () => {
  const db = openDataClient("file::memory:"); await createHistoricalPaTables(db);
  const row = parsed();
  expect(await replaceHistoricalPaGame(db, game.id, 2025, [row], "hash1", {})).toBe(3);
  expect(await replaceHistoricalPaGame(db, game.id, 2025, [row], "hash1", {})).toBe(0);
  await replaceHistoricalPaGame(db, game.id, 2025, [{ ...row, homeRuns: 1 }], "hash2", {});
  expect((await db.execute("SELECT homeRuns FROM mlb_historical_plate_appearances")).rows[0]?.homeRuns).toBe(1);
  await replaceHistoricalPaGame(db, game.id, 2025, [], "hash3", {});
  expect((await db.execute("SELECT COUNT(*) AS n FROM mlb_historical_plate_appearances")).rows[0]?.n).toBe(0);
  db.close();
});

describe("exact BvP and independent production gates", () => {
  it("excludes same Game presence without a matchup, and handles multi-Game/multi-season", () => {
    const pa = parsed({ othout: "0", single: "1" });
    const rows = [pa, { ...pa, season: 2024, gameId: "another-game" }, { ...pa, pitcherId: "different-pitcher" }];
    expect(exactBvp(rows, batter, pitcher).PA).toBe(2);
    expect(exactBvp(rows, batter, pitcher, 2025).PA).toBe(1);
    expect(exactBvp(rows, substitute, pitcher).PA).toBe(0);
    expect(exactBvp(rows, substitute, pitcher).AVG).toBeNull();
    expect(exactBvp(rows, batter, pitcher).AVG).toBe(1);
  });
  it("does not treat unexplained mismatch or skipped Game as ready", () => {
    const report = { season: 2020, expectedGames: 1, games: 1, reconstructedGames: 1, skippedGames: 0, parserFailures: 0, identityUnresolved: 0, mismatches: [], stateIssues: {} };
    const reports = Array.from({ length: 6 }, (_, index) => ({ ...report, season: 2020 + index }));
    expect(historicalAdvancedGate(reports)).toEqual({ directBvp: "ready", situations: "ready" });
    expect(historicalAdvancedGate([{ ...report, mismatches: [{}] }, ...reports.slice(1)]).directBvp).toBe("not_ready");
    expect(historicalAdvancedGate([{ ...report, stateIssues: { base_continuity: 1 } }, ...reports.slice(1)]))
      .toEqual({ directBvp: "ready", situations: "not_ready" });
    expect(historicalAdvancedGate([{ ...report, skippedGames: 1 }, ...reports.slice(1)]).directBvp).toBe("not_ready");
    expect(historicalAdvancedGate([{ ...report, expectedGames: 2 }, ...reports.slice(1)]).directBvp).toBe("not_ready");
    expect(historicalAdvancedGate(reports.map(() => report)).directBvp).toBe("not_ready");
  });
  it("rejects a public aggregate leak behind a closed gate", () => {
    const payload = { schemaVersion: 1, league: "MLB", playerId: batter, scope: "2025", directBvp: "not_ready", situations: "not_ready",
      batting: { opponents: [{ playerId: pitcher, name: "Pitcher", metrics: exactBvp([parsed()], batter, pitcher) }], splits: [] },
      pitching: { opponents: [], splits: [] } };
    expect(validStaticPayload("advanced/2025/player.json", payload)).toBe(false);
    expect(validStaticPayload("advanced/2025/player.json", { ...payload, directBvp: "ready" })).toBe(true);
  });
  it("keeps advanced requests deferred until the user expands the section", () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(HistoricalAdvancedAnalysis, { playerId: batter, season: 2025, hasBatting: true, hasPitching: false })));
    expect(html).toContain('aria-expanded="false"'); expect(html).toContain("対戦・状況別を見る");
    expect(html).not.toContain("対戦投手を検索");
  });
  it("displays sample and unavailable rate clearly", () => {
    const html = renderToStaticMarkup(createElement(PaMetricTable, { metrics: exactBvp([], batter, pitcher) }));
    expect(html).toContain("0"); expect(html).toContain("PA"); expect(html).toContain("—");
  });
});
