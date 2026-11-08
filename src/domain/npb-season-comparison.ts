import { canonicalEntityRefSchema } from "./cross-league";
import { compareBattingKeys, comparePitchingKeys } from "./player-compare";

export const npbSeasonComparisonCurrentYear = 2026;

export function npbSeasonComparisonMetricKeys(role: "batting" | "pitching") {
  return role === "batting" ? compareBattingKeys : comparePitchingKeys.map(key => key === "appearances" ? "G" : key);
}

export function npbSeasonComparisonYears(raw: string) {
  if (!/^20\d{2}(,20\d{2}){0,3}$/.test(raw)) return [];
  const years = raw.split(",").map(Number);
  return years.some(year => year > npbSeasonComparisonCurrentYear) ? [] : [...new Set(years)].sort((a, b) => a - b);
}

export function savedNpbSeasonComparison(params: URLSearchParams): URLSearchParams | null {
  const player = params.get("player"), role = params.get("role"), metric = params.get("metric");
  const years = npbSeasonComparisonYears(params.get("years") ?? "");
  if (params.get("seasonCompare") !== "1" || params.get("competition") !== "regular" || params.has("stage") ||
      !player || !canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id: player }).success ||
      (role !== "batting" && role !== "pitching") || !metric || !npbSeasonComparisonMetricKeys(role).includes(metric) || !years.length) return null;
  return new URLSearchParams({ seasonCompare: "1", player, role, years: years.join(","), metric, competition: "regular" });
}
