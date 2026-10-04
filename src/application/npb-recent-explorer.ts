import { z } from "zod";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import type { PlayerPeriodBatchResult } from "./player-period-batch";
import { npbSeasonPayloadSchema, seasonBattingKeys, seasonPitchingKeys } from "./npb-season-payload";
import { dateWindow } from "../domain/mlb-historical-aggregate";

// No ranking readiness or candidates: this is a bounded saved-Fact projection.
const shape = npbSeasonPayloadSchema.shape;
export const npbRecentExplorerSchema = z.strictObject({
  schemaVersion: shape.schemaVersion, league: shape.league, season: shape.season,
  effectiveDate: shape.effectiveDate, generatedAt: shape.generatedAt, period: shape.period, coverage: shape.coverage, players: shape.players,
  competition: z.literal("regular"), days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
}).superRefine((p, ctx) => {
  const window = dateWindow(p.effectiveDate, p.days);
  if (p.period.from !== window.from || p.period.to !== window.to || new Set(p.players.map(r => r.playerId)).size !== p.players.length)
    ctx.addIssue({ code: "custom", message: "Recent window/identity mismatch" });
  const s = p.coverage.summary;
  if (s.dates !== s.complete + s.noGames + s.partial + s.unknown + s.failed ||
      (p.coverage.status === "complete" && s.partial + s.unknown + s.failed > 0))
    ctx.addIssue({ code: "custom", message: "Inconsistent Recent coverage" });
});
export type NpbRecentExplorer = z.infer<typeof npbRecentExplorerSchema>;
export function validateNpbRecentFamily(raw: readonly unknown[], directory: NpbPlayerDirectory, season: number): NpbRecentExplorer[] {
  const values = raw.filter(p => p !== null && p !== undefined).map(p => npbRecentExplorerSchema.parse(p));
  if (!values.length) return [];
  if (values.length !== 3 || [7, 14, 30].some(days => values.filter(p => p.days === days).length !== 1)) throw Error("Recent publication family incomplete");
  const players = new Map(directory.players.map(p => [p.playerId, p]));
  if (values.some(p => p.effectiveDate !== directory.effectiveDate || p.season !== season || p.players.some(r => {
    const d = players.get(r.playerId); return !d || d.displayName !== r.displayName || d.teamId !== r.teamId;
  }))) throw Error("Recent publication scope/date/identity mismatch");
  return values;
}
export function buildNpbRecentExplorer(batch: PlayerPeriodBatchResult, directory: NpbPlayerDirectory): NpbRecentExplorer {
  if (!["7d", "14d", "30d"].includes(batch.period) || batch.window.to !== directory.effectiveDate)
    throw Error("Coordinated Recent/Directory required");
  const metadata = new Map(directory.players.map(p => [p.playerId, p]));
  const batters = new Map(batch.batters.map(p => [p.playerId, p])), pitchers = new Map(batch.pitchers.map(p => [p.playerId, p]));
  const project = (s: PlayerPeriodBatchResult["batters"][number] | PlayerPeriodBatchResult["pitchers"][number] | undefined, keys: readonly string[]) =>
    s ? { factCount: s.factCount, metrics: Object.fromEntries(keys.map(k => [k, (s.metrics as Record<string, unknown>)[k]])) } : null;
  return npbRecentExplorerSchema.parse({ schemaVersion: 1, league: "NPB", season: Number(batch.window.to.slice(0, 4)), competition: "regular",
    days: Number(batch.period.replace("d", "")), effectiveDate: batch.window.to, generatedAt: new Date().toISOString(),
    period: { from: batch.window.from, to: batch.window.to }, coverage: { status: batch.coverage.status, summary: batch.coverage.summary },
    players: [...new Set([...batters.keys(), ...pitchers.keys()])].sort().map(playerId => {
      const p = metadata.get(playerId); if (!p) throw Error("Recent canonical display metadata missing");
      return { playerId, displayName: p.displayName, teamId: p.teamId, batting: project(batters.get(playerId), seasonBattingKeys), pitching: project(pitchers.get(playerId), seasonPitchingKeys) };
    }) });
}
