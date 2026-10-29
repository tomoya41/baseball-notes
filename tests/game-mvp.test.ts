import { expect, it } from "vitest";
import { npbGameMvpInput, selectGameMvp, type GameMvpInput } from "../src/domain/game-mvp";
import { selectDailyMvp } from "../src/domain/daily-mvp";
import { mvpFixture } from "./fixtures/daily-mvp";

const now = Date.parse("2026-10-29T00:00:00Z");
const input = () => npbGameMvpInput(mvpFixture().game);
it("selects a game MVP even when another game on the date is uncollected, while daily selection stays closed", () => {
  const { game, index } = mvpFixture(), copy = JSON.stringify(game);
  expect(selectGameMvp(npbGameMvpInput(game), now)).toMatchObject({ status: "selected", gameId: game.gameId, competition: "regular", players: [{ name: "架空打者0", score: 9, reason: "4打数3安打・1本塁打・3打点" }] });
  expect(selectDailyMvp({ ...index, coverage: "partial" }, [game]).status).toBe("unavailable");
  expect(selectDailyMvp({ ...index, games: [...index.games, { ...index.games[0]!, gameId: "npb:game:bbbbbbbbbbbbbbbbbbbb" }] }, [game]).status).toBe("unavailable");
  expect(JSON.stringify(game)).toBe(copy);
});
it("does not select from incomplete boxes, scores alone, unfinished games, or future dates", () => {
  for (const update of [{ complete: false }, { final: false }, { batting: [] }, { pitching: [] }, { date: "2027-01-01" }]) expect(selectGameMvp({ ...input(), ...update }, now).status).toBe("unavailable");
});
it("holds the whole selection for unknown counts rather than treating null as zero", () => {
  for (const key of ["ab", "hits", "homeRuns", "rbi"] as const) { const v = input(); v.batting = v.batting.map((b, i) => i ? b : { ...b, [key]: null }); expect(selectGameMvp(v, now).status).toBe("unavailable"); }
  for (const key of ["outsRecorded", "so", "runs", "er"] as const) { const v = input(); v.pitching = v.pitching.map((p, i) => i ? p : { ...p, [key]: null }); expect(selectGameMvp(v, now).status).toBe("unavailable"); }
});
it("uses integer outs and the same formula as daily MVP", () => {
  const v = input(); v.pitching = v.pitching.map((p, i) => i ? p : { ...p, outsRecorded: 17, so: 10, runs: 0, er: 0 });
  expect(selectGameMvp(v, now)).toMatchObject({ status: "selected", players: [{ role: "pitching", reason: "5回 2/3・10奪三振・0失点（自責点0）" }] });
});
it("keeps tied selections and never uses a name or team as a player ID", () => {
  const v = input(); v.batting = v.batting.map(b => ({ ...b, hits: 3, homeRuns: 1, rbi: 3 }));
  expect(selectGameMvp(v, now)).toMatchObject({ status: "selected", players: [{ score: 9 }, { score: 9 }] });
  for (const playerId of ["同姓同名", "00000000-0000-0000-0000-000000000000", "mlb:player:00000000-0000-4000-8000-000000000001"]) { const bad = input(); bad.batting = bad.batting.map((p, i) => i ? p : { ...p, playerId }); expect(selectGameMvp(bad, now).status).toBe("unavailable"); }
});
it("rejects duplicated players, wrong clubs, impossible counts and noninteger pitching outs", () => {
  const variants: GameMvpInput[] = [];
  let v = input(); v.batting = [...v.batting, v.batting[0]!]; variants.push(v);
  v = input(); v.batting = v.batting.map((p, i) => i ? p : { ...p, teamId: "npb:team:giants" }); variants.push(v);
  v = input(); v.batting = v.batting.map((p, i) => i ? p : { ...p, hits: 5 }); variants.push(v);
  v = input(); v.pitching = v.pitching.map((p, i) => i ? p : { ...p, outsRecorded: 17.2 }); variants.push(v);
  v = input(); v.pitching = v.pitching.map((p, i) => i ? p : { ...p, er: 3, runs: 2 }); variants.push(v);
  for (const bad of variants) expect(selectGameMvp(bad, now).status).toBe("unavailable");
});
it("preserves independent MLB postseason scope and canonical IDs", () => {
  const v = input(), ids = ["mlb:team:00000000-0000-4000-8000-000000000010", "mlb:team:00000000-0000-4000-8000-000000000011"];
  const mlb: GameMvpInput = { ...v, league: "MLB", gameId: "mlb:game:00000000-0000-4000-8000-000000000012", date: "2025-10-01", competition: "postseason", teamIds: ids, batting: v.batting.map((p, i) => ({ ...p, teamId: ids[i]!, playerId: `mlb:player:${p.playerId}` })), pitching: v.pitching.map((p, i) => ({ ...p, teamId: ids[i]!, playerId: `mlb:player:${p.playerId}` })) };
  expect(selectGameMvp(mlb, now)).toMatchObject({ status: "selected", league: "MLB", competition: "postseason", gameId: mlb.gameId });
  expect(v.competition).toBe("regular");
});
it("does not weaken the existing home/away row-identity checks in daily selection", () => {
  const { game, index } = mvpFixture(); [game.batting.home, game.batting.away] = [game.batting.away, game.batting.home];
  expect(selectGameMvp(npbGameMvpInput(game), now).status).toBe("unavailable");
  expect(selectDailyMvp(index, [game]).status).toBe("unavailable");
});
