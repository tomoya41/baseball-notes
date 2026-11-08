import { canonicalEntityRefSchema } from "./cross-league";

export function npbComparisonOrigin(params: URLSearchParams) {
  const playerId = params.get("player"), season = params.get("fromSeason"), role = params.get("role") ?? "batting";
  if (!playerId || !season || !/^20\d{2}$/.test(season) ||
      !canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id: playerId }).success ||
      (role !== "batting" && role !== "pitching") ||
      (params.has("competition") && params.get("competition") !== "regular") || params.has("stage") ||
      !["schoolYear", "birthYear", "draftYear", "ageSeason"].includes(params.get("cohort") ?? "") ||
      ["player", "fromSeason", "role"].some(key => params.getAll(key).length > 1)) return null;
  return { playerId, season, role };
}

export function npbHistoricalComparisonLinks(playerId: string, role: "batting" | "pitching", season: number,
  fromSeason: number, birthYear: number | null) {
  const origin = { player: playerId, fromSeason: String(fromSeason), role };
  const age = birthYear === null ? null : season - birthYear;
  const knownAge = age !== null && age >= 0 && age <= 99;
  const school = new URLSearchParams({ ...origin, season: String(season), cohort: "schoolYear",
    peer: playerId, recentPlayers: playerId });
  const sameAge = new URLSearchParams({ ...origin, cohort: "ageSeason", recentPlayers: playerId });
  if (knownAge) sameAge.set("age", String(age));
  return { school: `/NPB/history?${school}`, sameAge: `/NPB/history?${sameAge}`, age: knownAge ? age : null };
}
