import { npbSeasonMetadataSchema, type NpbSeasonMetadata } from "../domain/npb-season";

// Manually verified calendar facts. These dates are metadata, never downloaded by the collector.
// The end is the latest listed regular-season fixture as checked, not a confirmed final game date.
export const npbRegularSeasons: readonly NpbSeasonMetadata[] = [npbSeasonMetadataSchema.parse({
  league: "NPB", season: 2026, competitionType: "regular",
  startDate: "2026-03-27", endDate: "2026-10-07", endDateStatus: "scheduled", status: "in_progress",
  source: ["https://npb.jp/games/2026/schedule_03_detail.html",
    "https://npb.jp/games/2026/schedule_10_detail.html"],
  verificationMethod: "Manual inspection of NPB official regular-season schedule, first and latest listed dates",
  verifiedAt: "2026-09-25T10:11:00.000Z",
  notes: "October 7 is the latest listed regular-season fixture as of verification. Postponements or added makeup games require a reviewed metadata update; it is not a confirmed final result.",
})];

export function findNpbRegularSeason(asOfDate: string): NpbSeasonMetadata | null {
  const candidates = npbRegularSeasons.filter((value) => value.season === Number(asOfDate.slice(0, 4)));
  return candidates.at(-1) ?? null;
}
