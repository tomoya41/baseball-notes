import { analysisQuerySchema } from "../domain/analysis";
import type { AnalysisCapabilities, AnalysisQuery, AnalysisResult, Split } from "../domain/analysis";
import { dateInZone } from "../domain/analysis-query";
import type { League } from "../domain/models";
import { analysisFilters } from "./analysis";

export type MatchupSection = "direct" | "arsenal" | "count" | "recent";
export function matchupQuery(input: {
  league: League; pitcherId: string; batterId: string; section: MatchupSection;
  actor?: "pitcher" | "batter"; manifest?: AnalysisCapabilities; now?: number;
}): AnalysisQuery {
  const timeZone = input.league === "NPB" ? "Asia/Tokyo" : "America/New_York";
  const direct = input.section === "direct";
  const actor = input.actor ?? "pitcher";
  const count = input.section === "count";
  const candidates = direct ? ["hits", "hr", "so", "bb", "avg", "obp", "slg", "ops"]
    : input.section === "arsenal" ? actor === "pitcher" ? ["usagePct", "whiffPct", "avgVelocity"]
      : ["xwoba", "whiffPct", "avg", "slg"]
      : count ? actor === "pitcher" ? ["usagePct", "whiffPct"] : ["swingPct", "whiffPct", "chasePct"]
        : actor === "pitcher" ? ["usagePct", "whiffPct", "avgVelocity"] : ["ops", "xwoba", "whiffPct"];
  const requirements = input.manifest?.metricRequirements;
  const supported = requirements ? candidates.filter((metric) => Object.hasOwn(requirements, metric)) : candidates;
  return analysisQuerySchema.parse({
    version: 2, league: input.league,
    subject: direct ? { kind: "matchup", pitcherId: input.pitcherId, batterId: input.batterId }
      : { kind: actor, playerId: actor === "pitcher" ? input.pitcherId : input.batterId },
    asOfDate: dateInZone(input.now ?? Date.now(), timeZone), timeZone,
    period: input.section === "recent" ? { kind: "last-days", days: 30 }
      : { kind: "season", year: Number(dateInZone(input.now ?? Date.now(), timeZone).slice(0, 4)) },
    seasonType: "regular",
    population: count ? "pitch-at-count" : actor === "pitcher" && !direct ? "batters-faced" : "plate-appearances",
    metricIds: supported.length ? supported : [candidates[0]],
    groupBy: direct || input.section === "recent" ? "none" : input.section === "arsenal" ? "pitch-type" : "count",
    filters: analysisFilters,
  });
}

export function firstSplit(result: AnalysisResult | null): Split | null {
  return result?.status === "data" ? result.splits[0] ?? null : null;
}
export function attentionPitch(pitcher: AnalysisResult | null, batter: AnalysisResult | null): {
  pitcher: Split; batter: Split;
} | null {
  if (pitcher?.status !== "data" || batter?.status !== "data") return null;
  if (pitcher.query.groupBy !== "pitch-type" || batter.query.groupBy !== "pitch-type" ||
    pitcher.coverage.completeThrough !== batter.coverage.completeThrough) return null;
  const against = new Map(batter.splits.map((split) => [split.key, split]));
  const paired = pitcher.splits.flatMap((split) => {
    const other = against.get(split.key);
    const usage = split.metrics.find((item) => item.definitionId === "usagePct" && item.value.status === "available");
    return other && usage?.value.status === "available" && split.sampleSize.pitches != null &&
      split.sampleSize.pitches >= 50 && (other.sampleSize.pitches ?? 0) >= 50
      ? [{ pitcher: split, batter: other, usage: usage.value.value }] : [];
  });
  paired.sort((a, b) => b.usage - a.usage);
  return paired[0] ?? null;
}
