import { recentIndexSchema, recentMonthSchema } from "./mlb-recent-explorer";
import { z } from "zod";
import { postseasonHubSchema } from "./competition";
import { historicalTeamHubSchema } from "./team-hub";
import { historicalChronologySchema } from "./game-chronology";

export const historicalCanonicalGameId = z.string().regex(/^mlb:game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const historicalCanonicalPlayerId = z.string().regex(/^mlb:player:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const teamId = z.string().regex(/^mlb:team:[0-9a-f-]{36}$/);
const count = z.number().int().nonnegative();
const nullable = count.nullable();
const season = z.number().int().min(2016).max(2025);
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

export function validStaticPayload(path: string, value: unknown, expectedScope: "regular" | "postseason" = "regular"): boolean {
  if (path.startsWith("postseason/")) {
    const scopedPath = path.slice("postseason/".length);
    if (!value || typeof value !== "object" || (value as { competitionType?: string }).competitionType !== "postseason") return false;
    if (/^hub\/\d{4}\.json$/.test(scopedPath)) {
      const parsed = postseasonHubSchema.safeParse(value);
      return parsed.success && scopedPath === `hub/${parsed.data.season}.json`;
    }
    if (scopedPath.startsWith("games/") && (value as { game?: { competitionType?: string } }).game?.competitionType !== "postseason") return false;
    const data = value as { player?: { id?: string }; game?: { id?: string }; playerId?: string; scope?: string; season?: number; date?: string };
    if (scopedPath.startsWith("games/") && scopedPath !== `games/${data.game?.id?.replaceAll(":", "_")}.json`) return false;
    if (scopedPath.startsWith("players/") && scopedPath !== "players/index.json" && scopedPath !== `players/${data.player?.id?.replaceAll(":", "_")}.json`) return false;
    if (scopedPath.startsWith("advanced/") && scopedPath !== "advanced/capabilities.json" && scopedPath !== `advanced/${data.scope}/${data.playerId?.replaceAll(":", "_")}.json`) return false;
    if (scopedPath.startsWith("schedule/") && scopedPath !== `schedule/${data.season}/${data.date}.json`) return false;
    if (scopedPath.startsWith("records/") && !/^records\/(range|decade-2010|decade-2020)\.json$/.test(scopedPath) && scopedPath !== `records/${data.season}.json`) return false;
    if (scopedPath.startsWith("seasons/") && scopedPath !== `seasons/${data.season}.json`) return false;
    return validStaticPayload(scopedPath, value, "postseason");
  }
  if (expectedScope === "regular" && value && typeof value === "object" &&
    ((value as { competitionType?: string }).competitionType === "postseason" || (value as { game?: { competitionType?: string } }).game?.competitionType === "postseason")) return false;
  if (path.startsWith("exploration/recent/")) {
    const match = /^exploration\/recent\/(201[6-9]|202[0-5])\/(index|20\d{2}-\d{2})\.json$/.exec(path);
    if (!match) return false;
    const parsed = match[2] === "index" ? recentIndexSchema.safeParse(value) : recentMonthSchema.safeParse(value);
    return parsed.success && parsed.data.season === Number(match[1]) && parsed.data.competitionType === expectedScope && (match[2] === "index" || ("month" in parsed.data && parsed.data.month === match[2]));
  }
  if (path.startsWith("teams/")) {
    const parsed = historicalTeamHubSchema.safeParse(value);
    return parsed.success && parsed.data.competitionType === expectedScope && path === `teams/${parsed.data.season}/${parsed.data.teamId.replaceAll(":", "_")}.json`;
  }
  if (path.startsWith("chronology/")) {
    const parsed = historicalChronologySchema.safeParse(value);
    return parsed.success && parsed.data.competitionType === expectedScope && path === `chronology/${parsed.data.season}.json`;
  }
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
    collectedRecordPeriods: z.array(z.object({ id: z.enum(["range", "decade-2010", "decade-2020"]), label: z.string().min(1), seasons: z.array(season).min(1) })).optional(),
    seasons: z.array(z.object({ season, firstDate: z.iso.date(), lastDate: z.iso.date(), games: count,
      coverage: z.enum(["complete", "partial", "unavailable"]), playerCount: count })).min(1),
    teams: z.array(z.object({ id: teamId, name: z.string().min(1) })).min(1),
    features: z.object({ directBvp: z.enum(["available", "unavailable", "evaluate"]),
      situationalAnalysis: z.enum(["available", "unavailable", "evaluate"]).optional(), collectedCountingRecords: z.enum(["available", "unavailable"]).optional() }).passthrough().optional() }).superRefine((data, context) => {
        const years = data.seasons.map(s => s.season);
        if (new Set(years).size !== years.length || years.some((year, i) => i > 0 && year <= years[i - 1]!)) context.addIssue({ code: "custom", message: "Invalid manifest seasons" });
        const periods = data.collectedRecordPeriods;
        if (data.features?.collectedCountingRecords === "available" && !periods?.length) context.addIssue({ code: "custom", message: "Collected records periods missing" });
        if (periods && (new Set(periods.map(p => p.id)).size !== periods.length || periods.some(p => new Set(p.seasons).size !== p.seasons.length ||
          p.seasons.some((year, i) => !years.includes(year) || (i > 0 && year <= p.seasons[i - 1]!) ||
            (p.id !== "range" && Math.floor(year / 10) * 10 !== Number(p.id.slice(7)))) || (p.id === "range" && p.seasons.join(",") !== years.join(",")))))
          context.addIssue({ code: "custom", message: "Invalid collected records period" });
      }).safeParse(value).success;
  if (path === "players/index.json") return base.extend({ players: z.array(player) }).safeParse(value).success;
  if (path.startsWith("players/")) return base.extend({ player: player.extend({ bats: z.string().nullable(), throws: z.string().nullable() }),
    collectedRange: z.string(), collectedRangeTotals: totals, seasonTotals: z.record(z.string(), totals),
    batting: z.array(batter.extend(dated)), pitching: z.array(pitcher.extend(dated)) }).safeParse(value).success;
  if (path.startsWith("games/")) return base.extend({ game: gameHeader.extend({ season, date: z.iso.date(), innings: nullable,
    batting: z.array(batter.extend({ name: z.string().nullable() })), pitching: z.array(pitcher.extend({ name: z.string().nullable() })) }) }).safeParse(value).success;
  if (path.startsWith("schedule/")) return base.extend({ season, date: z.iso.date(), games: z.array(gameHeader.extend({
    status: z.literal("final"), complete: z.boolean() })) }).safeParse(value).success;
  if (path.startsWith("seasons/")) return base.extend({ season, coverage: z.literal("complete"), firstDate: z.iso.date(),
    lastDate: z.iso.date(), gameCount: count, players: z.array(z.object({ playerId: historicalCanonicalPlayerId, batting: metrics, pitching: metrics })) }).safeParse(value).success;
  if (/^records\/(range|decade-2010|decade-2020)\.json$/.test(path)) return base.extend({ coverage: z.literal("complete"), counting: z.literal("ready"), rate: z.literal("not_ready"),
    collectedSeasons: z.array(season).min(1), records: z.array(z.object({ metric: z.string(), role: z.enum(["batting", "pitching"]),
      rows: z.array(z.object({ playerId: historicalCanonicalPlayerId, name: z.string(), value: count, rank: count })) }))
  }).superRefine((data, context) => {
    if (new Set(data.collectedSeasons).size !== data.collectedSeasons.length || data.collectedSeasons.some((year, index) => index > 0 && year <= data.collectedSeasons[index - 1]!))
      context.addIssue({ code: "custom", message: "Invalid collected season range" });
    const decade = /^records\/decade-(\d{4})\.json$/.exec(path)?.[1];
    if (decade && data.collectedSeasons.some(year => Math.floor(year / 10) * 10 !== Number(decade)))
      context.addIssue({ code: "custom", message: "Collected records decade mismatch" });
  }).safeParse(value).success;
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
