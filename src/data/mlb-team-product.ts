import { battingAggregate, pitchingAggregate, dateWindow, type DatedBatter, type DatedPitcher } from "../domain/mlb-historical-aggregate";
import { historicalTeamHubSchema, type HistoricalTeamHub } from "../domain/team-hub";
import type { HistoricalGame } from "./mlb-historical";

// Reads existing canonical Game projections; no Source access or canonical writes.
export function buildHistoricalTeamHub(games: readonly HistoricalGame[], names: ReadonlyMap<string, string>, input: { teamId: string; season: number; competitionType: "regular" | "postseason"; coverage: "complete" | "partial" | "unavailable"; effectiveDate: string }): HistoricalTeamHub {
  const selected = games.filter(g => g.season === input.season && (g.competitionType ?? "regular") === input.competitionType && [g.homeTeamId, g.awayTeamId].includes(input.teamId));
  const bats: DatedBatter[] = [], pitches: DatedPitcher[] = [];
  let W = 0, L = 0, T = 0, runsFor = 0, runsAgainst = 0;
  for (const g of selected) {
    const home = g.homeTeamId === input.teamId, opponentTeamId = home ? g.awayTeamId : g.homeTeamId;
    const own = home ? g.homeRuns : g.awayRuns, away = home ? g.awayRuns : g.homeRuns;
    if (own > away) W++; else if (own < away) L++; else T++;
    runsFor += own; runsAgainst += away;
    const context = { gameId: g.id, date: g.date, season: g.season, home, opponentTeamId };
    bats.push(...g.batting.filter(r => r.teamId === input.teamId).map(r => ({ ...r, ...context })));
    pitches.push(...g.pitching.filter(r => r.teamId === input.teamId).map(r => ({ ...r, ...context })));
  }
  const from = `${input.season}-01-01`, to = input.effectiveDate;
  const comparisonViews = Object.fromEntries(["7", "14", "30", "home", "away"].map(key => {
    const start = ["home", "away"].includes(key) ? from : dateWindow(to, Number(key) as 7 | 14 | 30).from;
    const included = selected.filter(g => g.date >= start && g.date <= to && (key === "home" ? g.homeTeamId === input.teamId : key === "away" ? g.awayTeamId === input.teamId : true));
    const games = new Set(included.map(g => g.id));
    let W = 0, L = 0, T = 0, runsFor = 0, runsAgainst = 0;
    for (const g of included) { const home = g.homeTeamId === input.teamId, a = home ? g.homeRuns : g.awayRuns, b = home ? g.awayRuns : g.homeRuns; runsFor += a; runsAgainst += b; if (a > b) W++; else if (a < b) L++; else T++; }
    return [key, { from: start, to, G: included.length, W, L, T, runsFor, runsAgainst,
      batting: battingAggregate(input.teamId, bats.filter(r => games.has(r.gameId)).map(r => ({ ...r, playerId: input.teamId })), start, to).metrics,
      pitching: pitchingAggregate(input.teamId, pitches.filter(r => games.has(r.gameId)).map(r => ({ ...r, playerId: input.teamId })), start, to).metrics }];
  }));
  const ids = [...new Set([...bats, ...pitches].map(r => r.playerId))].sort();
  return historicalTeamHubSchema.parse({ schemaVersion: 1, league: "MLB", ...input, G: selected.length, W, L, T, runsFor, runsAgainst,
    comparisonViews, batting: battingAggregate(input.teamId, bats.map(r => ({ ...r, playerId: input.teamId })), from, to).metrics,
    pitching: pitchingAggregate(input.teamId, pitches.map(r => ({ ...r, playerId: input.teamId })), from, to).metrics,
    games: [...selected].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number || a.id.localeCompare(b.id)).slice(0, 12).map(g => ({ gameId: g.id, date: g.date, number: g.number, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, homeRuns: g.homeRuns, awayRuns: g.awayRuns, complete: g.validationIssues.length === 0 })),
    players: ids.map(id => {
      const playerBats = bats.filter(r => r.playerId === id), playerPitches = pitches.filter(r => r.playerId === id);
      return { playerId: id, name: names.get(id) ?? "名称未確認", batting: playerBats.length ? battingAggregate(id, playerBats, from, to).metrics : null, pitching: playerPitches.length ? pitchingAggregate(id, playerPitches, from, to).metrics : null };
    }),
  });
}
