/** Explicit expansion bounds. Prior default and retired-player scope stay unchanged. */
export function historicalImportYears(from: number, hasDirectory: boolean): number[] {
  if (!Number.isInteger(from) || from < 2000 || from > 2015) throw Error("Reviewed starting year must be 2000–2015");
  if (from < 2015 && !hasDirectory) throw Error("Older-year expansion requires the saved Current Directory");
  return Array.from({ length: 2026 - from }, (_, i) => from + i);
}
export function yearsForSavedIdentity(years: readonly number[], playerId: string, historicalOnly: boolean, directoryIds: ReadonlySet<string>, reviewedHistoricalIds: ReadonlySet<string> = new Set()): number[] {
  return years.filter(year => year >= 2015 || !historicalOnly && directoryIds.has(playerId) || historicalOnly && reviewedHistoricalIds.has(playerId));
}
