import { z } from "zod";
import { canonicalEntityRefSchema } from "./cross-league";
import type { League } from "./models";
import type { NpbGameDetail } from "./npb-game-detail";
import { dateInZone } from "./analysis-query";

type Batter = { playerId: string; name: string | null; teamId: string; ab: number | null; hits: number | null; homeRuns: number | null; rbi: number | null };
type Pitcher = { playerId: string; name: string | null; teamId: string; outsRecorded: number | null; so: number | null; runs: number | null; er: number | null };
export type GameMvpInput = { league: League; gameId: string; date: string; competition: "regular" | "postseason"; final: boolean; complete: boolean; teamIds: readonly string[]; batting: readonly Batter[]; pitching: readonly Pitcher[] };
export type MvpCandidate = { playerId: string; name: string; teamId: string; gameId: string; role: "batting" | "pitching"; score: number; reason: string };
type Unavailable = { status: "unavailable"; reason: string };
export type GameMvpResult = { status: "selected"; league: League; gameId: string; date: string; competition: GameMvpInput["competition"]; players: MvpCandidate[] } | Unavailable;
const unavailable = (reason: string): Unavailable => ({ status: "unavailable", reason });
const counts = (values: (number | null)[]) => values.every(v => v !== null && Number.isSafeInteger(v) && v >= 0);
const innings = (outs: number) => `${Math.floor(outs / 3)}回${outs % 3 ? ` ${outs % 3}/3` : ""}`;

/** Same transparent scoring as daily MVP; the evidence boundary is one complete game. */
export function scoreGameMvp(input: GameMvpInput, now = Date.now()): { status: "scored"; candidates: MvpCandidate[] } | Unavailable {
  const ref = (kind: "game" | "team" | "player", id: string) => canonicalEntityRefSchema.safeParse({ league: input.league, kind, id }).success && (input.league !== "NPB" || kind !== "player" || id !== "00000000-0000-0000-0000-000000000000" && z.uuid().safeParse(id).success);
  if (!["regular", "postseason"].includes(input.competition) || !ref("game", input.gameId) || !z.iso.date().safeParse(input.date).success || input.teamIds.length !== 2 || new Set(input.teamIds).size !== 2 || input.teamIds.some(id => !ref("team", id))) return unavailable("試合・球団の照合が未完了です。");
  if (!input.final) return unavailable("試合終了を確認してから選出します。");
  if (input.date > dateInZone(now, input.league === "NPB" ? "Asia/Tokyo" : "America/New_York")) return unavailable("開催前の試合からは選出しません。");
  if (!input.complete) return unavailable("選手成績が一部未収録のため、選出を保留しています。");
  if (input.batting.length > 100 || input.pitching.length > 100 || input.teamIds.some(id => !input.batting.some(p => p.teamId === id) || !input.pitching.some(p => p.teamId === id))) return unavailable("両チームの選手成績が未収録です。");
  for (const rows of [input.batting, input.pitching]) {
    if (new Set(rows.map(p => p.playerId)).size !== rows.length || rows.some(p => !ref("player", p.playerId) || !p.name?.trim() || !input.teamIds.includes(p.teamId))) return unavailable("選手の照合・収録範囲を確認できません。");
  }
  const candidates: MvpCandidate[] = [];
  for (const p of input.batting) {
    if (!counts([p.ab, p.hits, p.homeRuns, p.rbi]) || p.hits! > p.ab! || p.homeRuns! > p.hits!) return unavailable("選考に必要な打撃成績が一部未収録です。");
    candidates.push({ playerId: p.playerId, name: p.name!, teamId: p.teamId, gameId: input.gameId, role: "batting", score: p.hits! + 3 * p.homeRuns! + p.rbi!, reason: `${p.ab}打数${p.hits}安打・${p.homeRuns}本塁打・${p.rbi}打点` });
  }
  for (const p of input.pitching) {
    if (!counts([p.outsRecorded, p.so, p.runs, p.er]) || p.er! > p.runs!) return unavailable("選考に必要な投手成績が一部未収録です。");
    candidates.push({ playerId: p.playerId, name: p.name!, teamId: p.teamId, gameId: input.gameId, role: "pitching", score: p.outsRecorded! / 3 + p.so! / 2 - 2 * p.runs!, reason: `${innings(p.outsRecorded!)}・${p.so}奪三振・${p.runs}失点（自責点${p.er}）` });
  }
  return { status: "scored", candidates };
}
export function selectGameMvp(input: GameMvpInput, now = Date.now()): GameMvpResult {
  const result = scoreGameMvp(input, now);
  if (result.status !== "scored") return result;
  const best = Math.max(...result.candidates.map(p => p.score));
  if (best <= 0) return unavailable("独自の選考基準に該当する成績はありません。");
  const players = result.candidates.filter(p => Math.abs(p.score - best) < 1e-8).sort((a, b) => a.playerId.localeCompare(b.playerId) || a.role.localeCompare(b.role));
  return { status: "selected", league: input.league, gameId: input.gameId, date: input.date, competition: input.competition, players };
}
export function npbGameMvpInput(game: NpbGameDetail): GameMvpInput {
  const sidesMatch = (["home", "away"] as const).every(side => [...game.batting[side], ...game.pitching[side]].every(p => p.teamId === game[side].id));
  return { league: "NPB", gameId: game.gameId, date: game.date, competition: "regular", final: game.status === "final", complete: game.completeness === "complete" && sidesMatch, teamIds: [game.away.id, game.home.id], batting: [...game.batting.away, ...game.batting.home], pitching: [...game.pitching.away, ...game.pitching.home].map(p => ({ ...p, so: p.strikeouts, er: p.earnedRuns })) };
}
