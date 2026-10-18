import { canonicalEntityRefSchema } from "./cross-league";
import type { NpbHistoricalManifest } from "./npb-historical";
import type { NpbCatalog } from "./npb-product-contract";

/** Historical-only DOB is independently verified at admission, never inferred from season/age. */
export function historicalBirthDate(playerId: string, catalog: NpbCatalog, manifest: NpbHistoricalManifest) {
  const identity = manifest.players.find(p => p.playerId === playerId), profile = catalog.players.find(p => p.playerId === playerId);
  const current = profile?.profile.birthDate ?? null, past = identity?.identityScope === "historical_only" ? identity.birthDate ?? null : null;
  if (current && past && current !== past) return { birthDate: null, source: "conflict" as const };
  return { birthDate: current ?? past, source: current ? "catalog" as const : past ? "historical" as const : "unknown" as const };
}

/** Age on December 31 of a season, not age at debut, rookie eligibility or career coverage. */
export function ageSeasonQuery(params: URLSearchParams) {
  const raw = params.get("age") ?? "26", age = Number(raw), role = params.get("role") ?? "batting", mode=params.get("ageMode")??"season";
  const ids = [...new Set((params.get("recentPlayers") ?? "").split(",").filter(Boolean))];
  const valid = /^\d{1,2}$/.test(raw) && age >= 0 && age <= 99 && ["batting", "pitching"].includes(role) && ["season","collected"].includes(mode)
    && ids.length <= 4 && ids.every(id => canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id }).success)
    && !["season", "stage", "years", "asOfDate", "date"].some(key => params.has(key))
    && (!params.has("period") || params.get("period") === "season") && (!params.has("competition") || params.get("competition") === "regular");
  return { age, role: role as "batting" | "pitching", mode:mode as "season"|"collected", ids, valid };
}

/** Year-end cutoff using only explicitly admitted years. Missing seasons remain unknown. */
export function ageCollectedPlan(ids:readonly string[],age:number,catalog:NpbCatalog,manifest:NpbHistoricalManifest){
  return ageSeasonPlan(ids,age,catalog,manifest).map(p=>{
    const identity=manifest.players.find(i=>i.playerId===p.playerId);
    const seasons=p.birthDate&&p.season!==null?(identity?.seasons??[]).filter(y=>y>=Number(p.birthDate!.slice(0,4))&&y<=p.season!&&manifest.seasons.some(s=>s.season===y)).slice().sort((a,b)=>a-b):[];
    if(seasons.length>36)throw Error("Collected age comparison exceeds 36-season bound");
    return {...p,seasons,available:seasons.length>0,reason:seasons.length?null:p.reason??"対象年齢までの過去年成績は未収録です"};
  });
}

export function ageSeasonPlan(ids: readonly string[], age: number, catalog: NpbCatalog, manifest: NpbHistoricalManifest) {
  if (!Number.isInteger(age) || age < 0 || age > 99 || ids.length > 4 || new Set(ids).size !== ids.length) throw Error("Invalid age comparison");
  return ids.map(playerId => {
    const identity = manifest.players.find(p => p.playerId === playerId), profile = catalog.players.find(p => p.playerId === playerId);
    const { birthDate, source } = historicalBirthDate(playerId, catalog, manifest);
    const season = birthDate ? Number(birthDate.slice(0, 4)) + age : null;
    const available = !!identity && season !== null && identity.seasons.includes(season) && manifest.seasons.some(s => s.season === season);
    return { playerId, name: identity?.name ?? profile?.displayName ?? "未確認の選手", birthDate, birthDateSource: source, season, available,
      reason: !identity ? "過去成績の選手情報が未収録です" : source === "conflict" ? "生年月日の照合情報が一致しません" : !birthDate ? "生年月日が未確認です" : !available ? "この年齢の年度成績は未収録です" : null };
  });
}
