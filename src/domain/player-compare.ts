import { canonicalEntityRefSchema } from "./cross-league";
import type { League } from "./models";
import type { PlayerAnalysisBundle } from "./player-analysis-bundle";
export type CompareMetrics = Record<string, { value: number | null; status?: string }>;
export const compareBattingKeys = ["G", "PA", "AB", "H", "HR", "RBI", "BB", "SO", "AVG", "OBP", "SLG", "OPS"];
export const comparePitchingKeys = ["appearances", "GS", "outsRecorded", "BF", "H", "HR", "SO", "R", "ER", "W", "L", "SV", "ERA", "K9"];
// Search classification only; actual metrics always come from the selected role's Facts.
export function historicalCompareRoles(positions: readonly string[]) {
  return { batting: positions.length === 0 || positions.some(p => p !== "P"), pitching: positions.length === 0 || positions.includes("P") };
}
export function compareIds(league: League, raw: string | null): string[] {
  return [...new Set((raw ?? "").split(",").filter(id => canonicalEntityRefSchema.safeParse({ league, kind: "player", id }).success))].slice(0, 4);
}
export function npbCompareSection(bundle: PlayerAnalysisBundle, role: "batting" | "pitching", condition: string, opponent: string, battingOrder = 1) {
  if (["7d", "14d", "30d"].includes(condition)) return bundle.comparison.status === "ready" ? bundle.comparison.payload.periods[condition as "7d" | "14d" | "30d"][role] : null;
  if (condition === "home" || condition === "away") return bundle.homeAway.status === "ready" && bundle.homeAway.payload.capability === "available" ? bundle.homeAway.payload[role][condition] : null;
  if (condition === "opponent") return bundle.opponent.status === "ready" ? bundle.opponent.payload.opponents.find(r => r.teamId === opponent)?.[role] ?? null : null;
  if (condition === "order") return role === "batting" && bundle.battingOrder.status === "ready" ? bundle.battingOrder.payload.orders.find(r => r.battingOrder === battingOrder)?.stats ?? null : null;
  if (condition === "starter" || condition === "substitute") return role === "batting" && bundle.batterRole.status === "ready" ? bundle.batterRole.payload[condition] : null;
  if (condition === "pitcher-starter" || condition === "reliever") return role === "pitching" && bundle.pitcherRole.status === "ready" ? bundle.pitcherRole.payload[condition === "pitcher-starter" ? "starter" : "reliever"] : null;
  return null;
}
