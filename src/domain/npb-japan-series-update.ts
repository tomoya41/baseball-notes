import { assertJapanSeriesAdvance, npbJapanSeriesSchema } from "./npb-japan-series";

/** Offline release diff only. No source requests, publication or Current evidence. */
export function japanSeriesUpdateReport(previous: unknown, candidate: unknown) {
  const before = npbJapanSeriesSchema.parse(previous), after = npbJapanSeriesSchema.parse(candidate);
  assertJapanSeriesAdvance(before, after);
  for (const source of before.sources) {
    const next = after.sources.find(s => s.pageId === source.pageId);
    if (!next || next.title !== source.title || next.revision < source.revision || next.revisionAt < source.revisionAt || next.revision === source.revision && next.contentSha256 !== source.contentSha256)
      throw Error("Japan Series source regression or revision/hash conflict");
  }
  const addedResults = after.series.games.filter(g => g.status === "final" && !before.results.some(r => r.gameId === g.gameId));
  const scheduleChanges = after.series.games.filter(g => {
    const old = before.series.games.find(p => p.gameId === g.gameId);
    return g.status !== "final" && (!old || JSON.stringify(g) !== JSON.stringify(old) || after.venues[g.gameId] !== before.venues[g.gameId]);
  });
  return {
    requiresPublication: addedResults.length > 0 || scheduleChanges.length > 0,
    addedResults: addedResults.map(g => ({ gameId: g.gameId, gameNumber: g.gameNumber, date: g.date, awayRuns: g.awayRuns, homeRuns: g.homeRuns, winnerId: g.winnerId })),
    scheduleChanges: scheduleChanges.map(g => ({ gameId: g.gameId, date: g.date, status: g.status, venue: after.venues[g.gameId], scheduledAt: g.scheduledAt })),
    resultsBefore: before.results.length, resultsAfter: after.results.length,
    standings: after.series.teams.map(t => ({ teamId: t.teamId, playedWins: t.playedWins })),
    clinched: after.series.clinched, coverage: after.coverage, playerStats: after.playerStats,
    canonicalWrites: 0, sourceRequests: 0,
  };
}
