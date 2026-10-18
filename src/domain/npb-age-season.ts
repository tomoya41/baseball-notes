import { canonicalEntityRefSchema } from "./cross-league";
import type { NpbHistoricalManifest } from "./npb-historical";
import type { NpbCatalog } from "./npb-product-contract";

/** Age on December 31 of a season, not age at debut, rookie eligibility or career coverage. */
export function ageSeasonQuery(params: URLSearchParams) {
  const raw = params.get("age") ?? "26", age = Number(raw), role = params.get("role") ?? "batting";
  const ids = [...new Set((params.get("recentPlayers") ?? "").split(",").filter(Boolean))];
  const valid = /^\d{1,2}$/.test(raw) && age >= 0 && age <= 99 && ["batting", "pitching"].includes(role)
    && ids.length <= 4 && ids.every(id => canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id }).success)
    && !["season", "stage", "years", "asOfDate", "date"].some(key => params.has(key))
    && (!params.has("period") || params.get("period") === "season") && (!params.has("competition") || params.get("competition") === "regular");
  return { age, role: role as "batting" | "pitching", ids, valid };
}

export function ageSeasonPlan(ids: readonly string[], age: number, catalog: NpbCatalog, manifest: NpbHistoricalManifest) {
  if (!Number.isInteger(age) || age < 0 || age > 99 || ids.length > 4 || new Set(ids).size !== ids.length) throw Error("Invalid age comparison");
  return ids.map(playerId => {
    const identity = manifest.players.find(p => p.playerId === playerId), profile = catalog.players.find(p => p.playerId === playerId);
    const birthDate = profile?.profile.birthDate ?? null;
    const season = birthDate ? Number(birthDate.slice(0, 4)) + age : null;
    const available = !!identity && season !== null && identity.seasons.includes(season) && manifest.seasons.some(s => s.season === season);
    return { playerId, name: identity?.name ?? profile?.displayName ?? "未確認の選手", birthDate, season, available,
      reason: !identity ? "過去成績の選手情報が未収録です" : !birthDate ? "生年月日が未確認です" : !available ? "この年齢の年度成績は未収録です" : null };
  });
}
