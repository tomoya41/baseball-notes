import { npbSeasonMetadataSchema, type NpbSeasonMetadata } from "../domain/npb-season";

// Manually verified calendar facts. These dates are metadata, never downloaded by the collector.
// The end is the latest listed regular-season fixture as checked, not a confirmed final game date.
export const npbRegularSeasons: readonly NpbSeasonMetadata[] = [npbSeasonMetadataSchema.parse({
  league: "NPB", season: 2026, competitionType: "regular",
  startDate: "2026-03-27", endDate: "2026-10-08", endDateStatus: "scheduled", status: "in_progress",
  source: ["https://npb.jp/games/2026/schedule_03_detail.html",
    "https://npb.jp/games/2026/schedule_10_detail.html", "https://npb.jp/scores/2026/1008/t-s-25/"],
  verificationMethod: "Codex-assisted source verification of official schedule and explicit regular-season Game classification; cross-checked with saved nf3 Game and Day",
  verifiedAt: "2026-10-13T12:34:27.000Z",
  notes: "October 8 is the latest listed regular-season fixture as of verification, independently classified as Central League regular season. October 10 is CS First Stage and is excluded. This calendar correction is not season-completion, Fact, backup or scheduled-production proof. Later makeup games require another reviewed metadata update.",
})];

export function findNpbRegularSeason(asOfDate: string): NpbSeasonMetadata | null {
  const candidates = npbRegularSeasons.filter((value) => value.season === Number(asOfDate.slice(0, 4)));
  return candidates.at(-1) ?? null;
}
