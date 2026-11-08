import { z } from "zod";
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
  const candidates = npbRegularSeasons.filter((value) => value.competitionType === "regular" &&
    value.season === Number(asOfDate.slice(0, 4)));
  return candidates.at(-1) ?? null;
}

const scheduleDateSchema = z.iso.date();

export function requireNpbRegularSeason(date: string): NpbSeasonMetadata {
  if (!scheduleDateSchema.safeParse(date).success) throw new Error("Invalid schedule date");
  const season = findNpbRegularSeason(date);
  if (!season) throw new Error("Season metadata unavailable; reviewed calendar required");
  return season;
}
