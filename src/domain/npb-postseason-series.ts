import { z } from "zod";
import { seriesSchema } from "./competition";
import { csSourceSchema, type NpbCsDataset } from "./npb-cs-observations";

/** Additive series evidence. Player/Game coverage remains the independently pinned CS release. */
export const npbPostseasonSeriesSchema = z.strictObject({
  schemaVersion: z.literal(1), league: z.literal("NPB"), season: z.literal(2026),
  competition: z.literal("postseason"), provider: z.literal("Wikipedia"), license: z.literal("CC-BY-SA-4.0"),
  coverage: z.literal("partial"), observedAt: z.iso.datetime(), baseBodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  transformation: z.string().min(1), sources: z.array(csSourceSchema).length(2),
  series: z.array(seriesSchema).length(4),
}).superRefine((d, ctx) => {
  const ids = new Set(d.series.map(s => s.id));
  const games = d.series.flatMap(s => s.games.map(g => g.gameId));
  if (ids.size !== 4 || new Set(games).size !== games.length || new Set(d.sources.map(s => s.pageId)).size !== 2 ||
    d.sources.some(s => s.revisionAt > d.observedAt) || d.series.some(s => s.league !== "NPB" || s.season !== 2026 ||
      !["npb_cs_first", "npb_cs_final"].includes(s.round) || s.effectiveDate > d.observedAt.slice(0, 10) ||
      !s.clinched || s.games.some(g => g.status !== "final") ||
      (s.round === "npb_cs_first" ? !s.advancesToSeriesId || !d.series.some(next => next.id === s.advancesToSeriesId && next.round === "npb_cs_final" && next.teams.some(t => t.teamId === s.winnerId)) : s.advancesToSeriesId !== null)))
    ctx.addIssue({ code: "custom", message: "Invalid NPB series evidence/advancement" });
});
export type NpbPostseasonSeries = z.infer<typeof npbPostseasonSeriesSchema>;

export function assertCsSeriesSnapshot(data: NpbPostseasonSeries, cs: NpbCsDataset) {
  const games = new Map(cs.games.map(g => [g.id, g]));
  if (data.observedAt !== cs.observedAt || JSON.stringify(data.sources) !== JSON.stringify(cs.sources) ||
    data.series.reduce((n, s) => n + s.games.length, 0) !== games.size || data.series.some(s => s.games.some(g => {
      const saved = games.get(g.gameId);
      return !saved || saved.stage !== s.round || saved.date !== g.date || saved.homeTeamId !== g.homeTeamId ||
        saved.awayTeamId !== g.awayTeamId || saved.homeScore !== g.homeRuns || saved.awayScore !== g.awayRuns;
    }))) throw Error("CS series/Game snapshot mismatch");
}
