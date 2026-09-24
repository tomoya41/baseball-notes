import { standingSchema, type GameFact, type Standing } from "../domain/standings";
import { mlb2025Teams } from "./retrosheet";

export function calculateStandings(games: readonly GameFact[], throughDate: string, calculatedAt: string): Standing[] {
  const season = Number(throughDate.slice(0, 4));
  const state = new Map(mlb2025Teams.map((team) => [team.id, {
    group: team.group, wins: 0, losses: 0, ties: 0, results: [] as number[],
  }]));
  for (const game of [...games].sort((a, b) => a.completedOn.localeCompare(b.completedOn) || a.id.localeCompare(b.id))) {
    if (game.completedOn > throughDate || game.season !== season) continue;
    const home = state.get(game.homeTeamId);
    const away = state.get(game.awayTeamId);
    if (!home || !away) throw new Error("Game references unmapped team");
    const result = Math.sign(game.homeRuns - game.awayRuns);
    if (result > 0) { home.wins++; away.losses++; }
    else if (result < 0) { away.wins++; home.losses++; }
    else { home.ties++; away.ties++; }
    home.results.push(result);
    away.results.push(-result);
  }
  const byGroup = new Map<string, Array<{ id: string; data: NonNullable<ReturnType<typeof state.get>> }>>();
  for (const [id, data] of state) {
    const rows = byGroup.get(data.group) ?? [];
    rows.push({ id, data });
    byGroup.set(data.group, rows);
  }
  const standings: Standing[] = [];
  for (const [group, rows] of byGroup) {
    rows.sort((a, b) => {
      const aPct = a.data.wins / (a.data.wins + a.data.losses || 1);
      const bPct = b.data.wins / (b.data.wins + b.data.losses || 1);
      return bPct - aPct || b.data.wins - a.data.wins || a.id.localeCompare(b.id);
    });
    const leader = rows[0];
    if (!leader) throw new Error("Empty competition group");
    rows.forEach(({ id, data }, index) => {
      const last = data.results.at(-1) ?? 0;
      let streak = 0;
      if (last !== 0) for (let cursor = data.results.length - 1; cursor >= 0 && data.results[cursor] === last; cursor--) streak += last;
      standings.push(standingSchema.parse({
        date: throughDate, season, league: "MLB", competitionGroup: group, teamId: id,
        rank: index + 1, wins: data.wins, losses: data.losses, ties: data.ties,
        gamesPlayed: data.wins + data.losses + data.ties,
        pct: data.wins / (data.wins + data.losses || 1),
        gamesBehindLeader: Math.max(0, (leader.data.wins - data.wins + data.losses - leader.data.losses) / 2),
        streak, sourceKey: "retrosheet-csv", collectedAt: calculatedAt, calculatedAt,
      }));
    });
  }
  return standings;
}
