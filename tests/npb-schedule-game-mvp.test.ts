import { expect, it } from "vitest";
import { savedGameMvpInputs, selectDailyMvp } from "../src/domain/daily-mvp";
import { mvpFixture } from "./fixtures/daily-mvp";

it("exposes only independently complete saved Games while day-wide selection remains held", () => {
  const { game, index } = mvpFixture(), before = JSON.stringify({ game, index });
  const other = { ...index.games[0]!, gameId: "npb:game:bbbbbbbbbbbbbbbbbbbb", completeness: "partial" as const, battingAvailable: false };
  const day = { ...index, coverage: "partial" as const, games: [...index.games, other] };
  expect(selectDailyMvp(day, [game]).status).toBe("unavailable");
  expect(savedGameMvpInputs(day, [game])).toMatchObject([{ summary: { gameId: game.gameId }, input: { competition: "regular", complete: true } }]);
  expect(JSON.stringify({ game, index })).toBe(before);
});

it("does not promote scores alone, stale corrections, duplicate or wrong-game caches", () => {
  const { game, index } = mvpFixture();
  for (const rows of [[], [game, game], [{ ...game, date: "2026-09-24" }], [{ ...game, gameNumber: 2 }],
    [{ ...game, home: { ...game.home, score: 9 } }], [{ ...game, away: game.home, home: game.away }],
    [{ ...game, gameId: "npb:game:bbbbbbbbbbbbbbbbbbbb" }], [{ ...game, completeness: "partial" as const }]]) {
    expect(savedGameMvpInputs(index, rows)).toEqual([]);
  }
  for (const summary of [{ ...index.games[0]!, completeness: "partial" as const }, { ...index.games[0]!, detailAvailable: false },
    { ...index.games[0]!, battingAvailable: false }, { ...index.games[0]!, pitchingAvailable: false },
    { ...index.games[0]!, away: { ...index.games[0]!.away, score: null } }, { ...index.games[0]!, status: "scheduled" as const }]) {
    expect(savedGameMvpInputs({ ...index, games: [summary] }, [game])).toEqual([]);
  }
});

it("retains missing-stat, identity and integer-outs guards without zero filling", () => {
  const { game, index } = mvpFixture();
  for (const key of ["ab", "hits", "homeRuns", "rbi"] as const) {
    const missing = structuredClone(game); missing.batting.home[0]![key] = null;
    expect(savedGameMvpInputs(index, [missing])).toEqual([]);
  }
  for (const key of ["outsRecorded", "strikeouts", "runs", "earnedRuns"] as const) {
    const missing = structuredClone(game); missing.pitching.home[0]![key] = null;
    expect(savedGameMvpInputs(index, [missing])).toEqual([]);
  }
  const unknown = structuredClone(game); unknown.batting.home[0]!.playerId = "同姓同名";
  expect(savedGameMvpInputs(index, [unknown])).toEqual([]);
  const invalid = structuredClone(game); invalid.pitching.home[0]!.outsRecorded = 5.2;
  expect(savedGameMvpInputs(index, [invalid])).toEqual([]);
});

it("does not select on failed/unknown/no-game dates, duplicated schedules or future Games", () => {
  const { game, index } = mvpFixture();
  for (const coverage of ["failed", "unknown", "no_games"] as const) expect(savedGameMvpInputs({ ...index, coverage }, [game])).toEqual([]);
  expect(savedGameMvpInputs({ ...index, games: [...index.games, index.games[0]!] }, [game])).toEqual([]);
  expect(savedGameMvpInputs({ ...index, games: Array(13).fill(index.games[0]!) }, [game])).toEqual([]);
  const date = "2099-09-25";
  expect(savedGameMvpInputs({ ...index, date, games: index.games.map(g => ({ ...g, date })) }, [{ ...game, date }])).toEqual([]);
});
