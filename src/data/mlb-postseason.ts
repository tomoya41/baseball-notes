import { historicalId, type HistoricalGame } from "./mlb-historical";
import { postseasonHubSchema, roundLabels, seriesStanding, type PostseasonHub, type PostseasonRound, type PostseasonSeries } from "../domain/competition";

// Versioned competition rules, not inferred from the number of played Games.
export function mlbPostseasonBestOf(season: number, round: PostseasonRound): number {
  if (!Number.isInteger(season) || season < 2016 || season > 2025) throw new Error("Unreviewed postseason format");
  if (round === "wild_card") return season <= 2019 || season === 2021 ? 1 : 3;
  if (round === "division_series") return 5;
  if (["alcs", "nlcs", "world_series"].includes(round)) return 7;
  throw new Error("Not an MLB round");
}
const order = (round: PostseasonRound) => ({ wild_card: 0, division_series: 1, alcs: 2, nlcs: 2, world_series: 3, npb_cs_first: 0, npb_cs_final: 1, japan_series: 2 })[round];

export function buildPostseasonHub(games: readonly HistoricalGame[], archiveSha256: string, generatedAt: string): PostseasonHub {
  if (!games.length || games.some(g => g.competitionType !== "postseason" || !g.postseasonRound || g.season !== games[0]!.season || g.validationIssues.length))
    throw new Error("Postseason scope/validation mismatch");
  const season = games[0]!.season;
  const groups = new Map<string, HistoricalGame[]>();
  for (const game of games) {
    const key = `${game.postseasonRound}:${[game.homeTeamId, game.awayTeamId].sort().join(":")}`;
    groups.set(key, [...(groups.get(key) ?? []), game]);
  }
  const series: PostseasonSeries[] = [...groups].map(([key, rows]) => {
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number || a.id.localeCompare(b.id));
    const round = rows[0]!.postseasonRound!, bestOf = mlbPostseasonBestOf(season, round), winsRequired = Math.floor(bestOf / 2) + 1;
    const teams = [rows[0]!.homeTeamId, rows[0]!.awayTeamId].sort().map(teamId => ({ teamId,
      ...seriesStanding(rows.filter(g => (g.homeRuns > g.awayRuns ? g.homeTeamId : g.awayTeamId) === teamId).length, 0) }));
    if (rows.some(g => g.homeRuns === g.awayRuns) || rows.length > bestOf || teams.some(t => t.seriesTotal > winsRequired)) throw new Error("Invalid postseason series results");
    const winner = teams.find(t => t.seriesTotal === winsRequired);
    // No games after an already clinched series.
    if (winner && rows.slice(0, -1).filter(g => (g.homeRuns > g.awayRuns ? g.homeTeamId : g.awayTeamId) === winner.teamId).length >= winsRequired)
      throw new Error("Game after series clinch");
    return { id: historicalId("series", `${season}:${key}`), league: "MLB", season, competitionType: "postseason", round,
      name: `${season} ${roundLabels[round]}`, bestOf, winsRequired, teams,
      games: rows.map((g, i) => ({ gameId: g.id, date: g.date, gameNumber: i + 1, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
        homeRuns: g.homeRuns, awayRuns: g.awayRuns, status: "final", scheduledAt: null, winnerId: g.homeRuns > g.awayRuns ? g.homeTeamId : g.awayTeamId })),
      status: winner ? "complete" : "in_progress", winnerId: winner?.teamId ?? null, clinched: Boolean(winner),
      clinchReason: "wins_required",
      advancesToSeriesId: null, effectiveDate: rows.at(-1)!.date };
  });
  for (const s of series) if (s.winnerId && s.round !== "world_series") {
    const next = series.filter(n => order(n.round) === order(s.round) + 1 && n.teams.some(t => t.teamId === s.winnerId));
    if (next.length !== 1) throw new Error("Missing/ambiguous advancement");
    s.advancesToSeriesId = next[0]!.id;
  }
  series.sort((a, b) => order(a.round) - order(b.round) || a.id.localeCompare(b.id));
  const expectedSeries = season === 2020 ? 15 : season <= 2021 ? 9 : 11;
  if (series.length !== expectedSeries || series.filter(s => s.round === "world_series").length !== 1) throw new Error("Incomplete postseason bracket");
  return postseasonHubSchema.parse({ schemaVersion: 1, league: "MLB", season, competitionType: "postseason",
    coverage: "complete", effectiveDate: [...games].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date, generatedAt,
    series, games: games.length, battingFacts: games.reduce((n, g) => n + g.batting.length, 0), pitchingFacts: games.reduce((n, g) => n + g.pitching.length, 0),
    playerStats: { status: "available", reason: null }, analysis: { status: "not_ready", reason: "PA validation pending" },
    provenance: { provider: "Retrosheet", archiveSha256, verifiedAt: generatedAt } });
}
