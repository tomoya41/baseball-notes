import { z } from "zod";

/** Missing scope means the legacy regular-season contract, never "all". */
export const competitionTypeSchema = z.enum(["regular", "postseason"]);
export type CompetitionType = z.infer<typeof competitionTypeSchema>;
export const postseasonRoundSchema = z.enum(["npb_cs_first", "npb_cs_final", "japan_series", "wild_card", "division_series", "alcs", "nlcs", "world_series"]);
export type PostseasonRound = z.infer<typeof postseasonRoundSchema>;
export const roundLabels: Record<PostseasonRound, string> = {
  npb_cs_first: "CS ファースト", npb_cs_final: "CS ファイナル", japan_series: "日本シリーズ",
  wild_card: "ワイルドカード", division_series: "地区シリーズ", alcs: "ALCS", nlcs: "NLCS", world_series: "ワールドシリーズ",
};
export const capabilitySchema = z.object({ status: z.enum(["available", "unavailable", "not_ready"]), reason: z.string().nullable() });
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const team = z.string().regex(new RegExp(`^(?:mlb:team:)?${uuid}$`));
const seriesId = z.string().regex(new RegExp(`^(mlb|npb):series:${uuid}$`));
const count = z.number().int().nonnegative();
export const seriesSchema = z.object({
  id: seriesId, league: z.enum(["MLB", "NPB"]), season: z.number().int(),
  competitionType: z.literal("postseason"), round: postseasonRoundSchema, name: z.string(),
  bestOf: z.number().int().positive(), winsRequired: z.number().int().positive(),
  teams: z.array(z.object({ teamId: team, playedWins: count, advantageWins: count, seriesTotal: count })).length(2),
  games: z.array(z.object({ gameId: z.string().regex(new RegExp(`^(?:mlb:game:)?${uuid}$`)), date: z.iso.date(), gameNumber: z.number().int().positive(),
    homeTeamId: team, awayTeamId: team, homeRuns: count.nullable(), awayRuns: count.nullable(),
    status: z.enum(["scheduled", "in_progress", "final", "postponed", "cancelled", "suspended"]),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(), winnerId: team.nullable() })),
  status: z.enum(["in_progress", "complete"]), winnerId: team.nullable(), clinched: z.boolean(),
  clinchReason: z.enum(["wins_required", "competition_rule"]).default("wins_required"),
  advancesToSeriesId: seriesId.nullable(), effectiveDate: z.iso.date(),
}).superRefine((s, ctx) => {
  const ids = new Set(s.teams.map(t => t.teamId));
  const mlb = s.league === "MLB";
  if (s.round.startsWith("npb_") || s.round === "japan_series" ? mlb : !mlb)
    ctx.addIssue({ code: "custom", message: "League/round mismatch" });
  if (s.teams.some(t => t.teamId.startsWith("mlb:") !== mlb) ||
    s.games.some(g => g.gameId.startsWith("mlb:") !== mlb || !g.date.startsWith(`${s.season}-`)))
    ctx.addIssue({ code: "custom", message: "Canonical league/season mismatch" });
  if (!s.id.startsWith(`${s.league.toLowerCase()}:series:`) || ids.size !== 2 || s.games.some(g => !ids.has(g.homeTeamId) || !ids.has(g.awayTeamId) || g.homeTeamId === g.awayTeamId || (g.winnerId !== null && !ids.has(g.winnerId))))
    ctx.addIssue({ code: "custom", message: "Series participant mismatch" });
  if (new Set(s.games.map(g => g.gameId)).size !== s.games.length || s.games.some((g, i) => g.gameNumber !== i + 1))
    ctx.addIssue({ code: "custom", message: "Series Game sequence mismatch" });
  for (const t of s.teams) if (t.playedWins !== s.games.filter(g => g.winnerId === t.teamId).length || t.seriesTotal !== t.playedWins + t.advantageWins)
    ctx.addIssue({ code: "custom", message: "Series wins mismatch" });
  if (s.games.some(g => g.status === "final" ? g.homeRuns === null || g.awayRuns === null ||
    g.winnerId !== (g.homeRuns > g.awayRuns ? g.homeTeamId : g.awayRuns > g.homeRuns ? g.awayTeamId : null) : g.winnerId !== null))
    ctx.addIssue({ code: "custom", message: "Game result mismatch" });
  if (s.teams.some(t => t.advantageWins > 0 && (s.round !== "npb_cs_final" || t.advantageWins !== 1)))
    ctx.addIssue({ code: "custom", message: "Invalid rule advantage" });
  if (s.clinched !== (s.status === "complete") || (s.clinched && (!s.winnerId || !ids.has(s.winnerId))) ||
    (s.clinched && s.clinchReason === "wins_required" && !s.teams.some(t => t.teamId === s.winnerId && t.seriesTotal === s.winsRequired)) ||
    (!s.clinched && s.winnerId !== null) ||
    (s.league === "MLB" && (s.clinchReason !== "wins_required" || s.games.some(g => g.status === "final" && g.winnerId === null) || s.teams.some(t => t.advantageWins !== 0))))
    ctx.addIssue({ code: "custom", message: "Series clinch mismatch" });
});
export type PostseasonSeries = z.infer<typeof seriesSchema>;
export const postseasonHubSchema = z.object({ schemaVersion: z.literal(1), league: z.literal("MLB"),
  season: z.number().int().min(2016).max(2025), competitionType: z.literal("postseason"),
  coverage: z.enum(["complete", "partial"]), effectiveDate: z.iso.date(), generatedAt: z.iso.datetime(),
  series: z.array(seriesSchema).min(1), games: count, battingFacts: count, pitchingFacts: count,
  playerStats: capabilitySchema, analysis: capabilitySchema,
  provenance: z.object({ provider: z.literal("Retrosheet"), archiveSha256: z.string().regex(/^[0-9a-f]{64}$/), verifiedAt: z.iso.datetime() }),
}).superRefine((h, ctx) => {
  if (h.games !== h.series.reduce((n, s) => n + s.games.length, 0) || h.series.some(s => s.season !== h.season || s.league !== h.league))
    ctx.addIssue({ code: "custom", message: "Hub counts/season mismatch" });
  const seriesIds = new Set(h.series.map(s => s.id));
  const games = h.series.flatMap(s => s.games.map(g => g.gameId));
  if (seriesIds.size !== h.series.length || new Set(games).size !== games.length || h.series.some(s => s.advancesToSeriesId && !seriesIds.has(s.advancesToSeriesId)))
    ctx.addIssue({ code: "custom", message: "Bracket reference mismatch" });
  if (h.coverage === "complete" && h.series.some(s => !s.clinched || s.games.some(g => g.status !== "final"))) ctx.addIssue({ code: "custom", message: "Unfinished series" });
});
export type PostseasonHub = z.infer<typeof postseasonHubSchema>;

/** NPB Final Stage's credited win is a rule advantage, never a Game Fact. */
export function seriesStanding(playedWins: number, advantageWins: number) {
  if (![playedWins, advantageWins].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("Invalid series wins");
  return { playedWins, advantageWins, seriesTotal: playedWins + advantageWins };
}
export function competitionFromSearch(search: URLSearchParams): CompetitionType {
  return search.get("competition") === "postseason" ? "postseason" : "regular";
}
