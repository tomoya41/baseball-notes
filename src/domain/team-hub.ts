import { z } from "zod";
const uuid = "[0-9a-f-]{36}";
const teamId = z.string().regex(new RegExp(`^mlb:team:${uuid}$`));
const playerId = z.string().regex(new RegExp(`^mlb:player:${uuid}$`));
const count = z.number().int().nonnegative();
const metrics = z.record(z.string(), z.object({ value: z.number().finite().nullable(), status: z.enum(["complete", "partial", "unavailable"]) }).passthrough());
const view = z.object({ from: z.iso.date(), to: z.iso.date(), G: count, W: count, L: count, T: count, runsFor: count, runsAgainst: count, batting: metrics, pitching: metrics }).refine(v => v.from <= v.to && v.G === v.W + v.L + v.T, "Invalid team comparison window");
export const historicalTeamHubSchema = z.object({ schemaVersion: z.literal(1), league: z.literal("MLB"),
  season: z.number().int().min(2020).max(2025), competitionType: z.enum(["regular", "postseason"]),
  teamId, effectiveDate: z.iso.date(), coverage: z.enum(["complete", "partial", "unavailable"]),
  G: count, W: count, L: count, T: count, runsFor: count, runsAgainst: count,
  batting: metrics, pitching: metrics,
  comparisonViews: z.object({ "7": view, "14": view, "30": view, home: view, away: view }).optional(),
  games: z.array(z.object({ gameId: z.string().regex(/^mlb:game:[0-9a-f-]{36}$/), date: z.iso.date(), number: count,
    homeTeamId: teamId, awayTeamId: teamId, homeRuns: count, awayRuns: count, complete: z.boolean() })).max(12),
  players: z.array(z.object({ playerId, name: z.string(), batting: metrics.nullable(), pitching: metrics.nullable() })),
}).superRefine((p, c) => {
  if (p.comparisonViews && Object.values(p.comparisonViews).some(v => v.to !== p.effectiveDate || Number(v.to.slice(0, 4)) !== p.season)) c.addIssue({ code: "custom", message: "Team comparison date mismatch" });
  if (p.G !== p.W + p.L + p.T || new Set(p.players.map(r => r.playerId)).size !== p.players.length || new Set(p.games.map(g => g.gameId)).size !== p.games.length || p.games.some(g => g.date > p.effectiveDate || Number(g.date.slice(0, 4)) !== p.season || ![g.homeTeamId, g.awayTeamId].includes(p.teamId))) c.addIssue({ code: "custom", message: "Inconsistent Team Hub" });
});
export type HistoricalTeamHub = z.infer<typeof historicalTeamHubSchema>;
