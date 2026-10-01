import type { HistoricalPlayer } from "../data/mlb-historical";
export type HistoricalDirectoryPlayer = Pick<HistoricalPlayer, "id" | "name" | "positions" | "seasons" | "teamIds"> & { postseasonOnly?: boolean };
/** Identity union only. Never adds postseason seasons/counts to a regular Player's facts. */
export function mergeHistoricalDirectory(regular: readonly HistoricalDirectoryPlayer[], postseason: readonly HistoricalDirectoryPlayer[]) {
  const known = new Set(regular.map(p => p.id));
  return [...regular, ...postseason.filter(p => !known.has(p.id)).map(p => ({ ...p, postseasonOnly: true }))];
}
