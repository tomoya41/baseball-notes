import { z } from "zod";

export const historicalCanonicalGameId = z.string().regex(/^mlb:game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const historicalCanonicalPlayerId = z.string().regex(/^mlb:player:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const teamId = z.string().regex(/^mlb:team:[0-9a-f-]{36}$/);
const count = z.number().int().nonnegative();
const nullable = count.nullable();
const season = z.number().int().min(2020).max(2025);
const base = z.object({ schemaVersion: z.literal(1), league: z.literal("MLB") });
const metric = z.object({ value: z.number().finite().nullable() }).passthrough();
const metrics = z.record(z.string(), metric).nullable();
const totals = z.object({ batting: metrics, pitching: metrics });
const player = z.object({ id: historicalCanonicalPlayerId, name: z.string().min(1),
  positions: z.array(z.string()), seasons: z.array(season).min(1), teamIds: z.array(teamId) }).passthrough();
const batter = z.object({ playerId: historicalCanonicalPlayerId, teamId,
  battingOrder: z.number().int().min(1).max(9).nullable(), appearanceOrder: nullable, starter: z.boolean().nullable(),
  pa: nullable, ab: nullable, runs: nullable, hits: nullable, doubles: nullable, triples: nullable,
  homeRuns: nullable, rbi: nullable, bb: nullable, hbp: nullable, sh: nullable, sf: nullable,
  so: nullable, sb: nullable, cs: nullable }).passthrough();
const pitcher = z.object({ playerId: historicalCanonicalPlayerId, teamId,
  role: z.enum(["starter", "reliever", "unknown"]), appearanceOrder: nullable,
  outsRecorded: nullable, bf: nullable, hits: nullable, homeRuns: nullable, bb: nullable,
  hbp: nullable, so: nullable, runs: nullable, er: nullable, win: z.boolean().nullable(),
  loss: z.boolean().nullable(), save: z.boolean().nullable(), hold: nullable, pitchCount: nullable }).passthrough();
const dated = { gameId: historicalCanonicalGameId, date: z.iso.date(), season, home: z.boolean(), opponentTeamId: teamId };
const gameHeader = z.object({ id: historicalCanonicalGameId, homeTeamId: teamId, awayTeamId: teamId,
  homeRuns: count, awayRuns: count, number: count });
const paMetrics = z.object({ PA: count, AB: count, H: count, "2B": count, "3B": count, HR: count,
  BB: count, HBP: count, SO: count, SH: count, SF: count,
  AVG: z.number().finite().nonnegative().nullable(), OBP: z.number().finite().nonnegative().nullable(),
  SLG: z.number().finite().nonnegative().nullable(), OPS: z.number().finite().nonnegative().nullable() });
const advancedSection = z.object({ opponents: z.array(z.object({ playerId: historicalCanonicalPlayerId, name: z.string(), metrics: paMetrics })),
  splits: z.array(z.object({ key: z.string().regex(/^(inning|outs|bases|score):/), metrics: paMetrics, unknownPa: count })) });

export function validStaticPayload(path: string, value: unknown): boolean {
  if (path === "advanced/capabilities.json") return base.extend({ directBvp: z.enum(["ready", "not_ready"]),
    situations: z.enum(["ready", "not_ready"]), scope: z.string(), rawPaPublic: z.literal(false),
    unknownContexts: z.array(z.object({ season, pa: count })), timesThroughOrder: z.literal("evaluate"),
    count: z.literal("evaluate"), statcast: z.literal("unavailable") }).safeParse(value).success;
  if (path.startsWith("advanced/") && path !== "advanced/capabilities.json") return base.extend({ playerId: historicalCanonicalPlayerId,
    scope: z.string(), directBvp: z.enum(["ready", "not_ready"]), situations: z.enum(["ready", "not_ready"]),
    batting: advancedSection, pitching: advancedSection }).superRefine((data, context) => {
      if (data.directBvp !== "ready" && (data.batting.opponents.length || data.pitching.opponents.length))
        context.addIssue({ code: "custom", message: "BvP gate closed" });
      if (data.situations !== "ready" && (data.batting.splits.length || data.pitching.splits.length))
        context.addIssue({ code: "custom", message: "Situation gate closed" });
    }).safeParse(value).success;
  if (path === "manifest.json") return base.extend({ current2026: z.literal("unavailable"),
    seasons: z.array(z.object({ season, firstDate: z.iso.date(), lastDate: z.iso.date(), games: count,
      coverage: z.enum(["complete", "partial", "unavailable"]), playerCount: count })).min(1),
    teams: z.array(z.object({ id: teamId, name: z.string().min(1) })).min(1),
    features: z.object({ directBvp: z.enum(["available", "unavailable", "evaluate"]),
      situationalAnalysis: z.enum(["available", "unavailable", "evaluate"]).optional() }).passthrough().optional() }).safeParse(value).success;
  if (path === "players/index.json") return base.extend({ players: z.array(player) }).safeParse(value).success;
  if (path.startsWith("players/")) return base.extend({ player: player.extend({ bats: z.string().nullable(), throws: z.string().nullable() }),
    collectedRange: z.string(), collectedRangeTotals: totals, seasonTotals: z.record(z.string(), totals),
    batting: z.array(batter.extend(dated)), pitching: z.array(pitcher.extend(dated)) }).safeParse(value).success;
  if (path.startsWith("games/")) return base.extend({ game: gameHeader.extend({ season, date: z.iso.date(), innings: nullable,
    batting: z.array(batter.extend({ name: z.string().nullable() })), pitching: z.array(pitcher.extend({ name: z.string().nullable() })) }) }).safeParse(value).success;
  if (path.startsWith("schedule/")) return base.extend({ season, date: z.iso.date(), games: z.array(gameHeader.extend({
    status: z.literal("final"), complete: z.boolean() })) }).safeParse(value).success;
  if (path.startsWith("records/")) return base.extend({ coverage: z.literal("complete"), counting: z.literal("ready"),
    rate: z.enum(["ready", "not_ready"]), records: z.array(z.object({ metric: z.string(), role: z.enum(["batting", "pitching"]),
      classification: z.enum(["rate", "counting"]).optional(), group: z.enum(["AL", "NL"]).optional(),
      rows: z.array(z.object({ playerId: historicalCanonicalPlayerId, name: z.string(), value: z.number().finite().nonnegative(), rank: count,
        qualification: z.enum(["qualified", "qualified_by_exception"]).optional(), rankingValue: z.number().finite().nonnegative().optional(),
        sample: count.optional(), missingPa: nullable.optional() })) })) }).superRefine((data, context) => {
      if (data.rate !== "ready" && data.records.some(record => record.classification === "rate" && record.rows.length))
        context.addIssue({ code: "custom", message: "Rate gate closed" });
      for (const record of data.records) if (record.classification === "rate" && (!record.group || record.rows.some(row => !row.qualification)))
        context.addIssue({ code: "custom", message: "Qualification missing" });
    }).safeParse(value).success;
  return false;
}
