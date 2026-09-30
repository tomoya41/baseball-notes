import { positionCodeSchema, positionDefinitions } from "../domain/baseball-terms";
export function historicalPositions(values: readonly string[]): string {
  return values.map(value => { const parsed = positionCodeSchema.safeParse(value); return parsed.success ? positionDefinitions[parsed.data] : value; }).join("・");
}
export function collectedSeasonsLabel(seasons: readonly number[]): string {
  const sorted = [...new Set(seasons)].sort((a,b) => a-b);
  return sorted.length > 2 ? `${sorted[0]}–${sorted.at(-1)} · ${sorted.length}シーズン` : sorted.map(year => `${year}年`).join(" / ");
}
