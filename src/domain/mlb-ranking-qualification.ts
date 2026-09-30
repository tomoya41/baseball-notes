// MLB Rule 9.22 uses scheduled league games. The revised 2020 schedule had 60;
// 2021–2025 had 162. Do not use observed games as the denominator.
export function scheduledMlbGames(season: number): number | null {
  if (season === 2020) return 60;
  if (season >= 2021 && season <= 2025) return 162;
  return null;
}
export type Qualification = "qualified" | "unqualified" | "unknown";
export function mlbBattingQualification(season: number, pa: number | null): Qualification {
  const games = scheduledMlbGames(season);
  if (games === null || pa === null) return "unknown";
  return pa >= Math.round(games * 3.1) ? "qualified" : "unqualified";
}
export function mlbPitchingQualification(season: number, outsRecorded: number | null): Qualification {
  const games = scheduledMlbGames(season);
  if (games === null || outsRecorded === null) return "unknown";
  return outsRecorded >= games * 3 ? "qualified" : "unqualified";
}
