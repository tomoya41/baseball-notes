import { ageOnDate, type NpbCatalog } from "./npb-product-contract";
import { normalizePlayerSearch } from "./npb-player-directory";
import { readableMetric, type ExplorerRow } from "./data-explorer";

export type LifecyclePlayer = NpbCatalog["players"][number];
export function playerSchools(player: LifecyclePlayer): string[] {
  // Labels remain source labels: no canonical school merging or graduation claim.
  return [...new Set([...(player.profile.schools ?? []), ...(player.profile.amateurHistory ?? []).map(s => s.name)])];
}
export function lifecycleCoverage(catalog: NpbCatalog) {
  const count = (test: (p: LifecyclePlayer) => boolean) => catalog.players.filter(test).length;
  return { total: catalog.players.length, draftYear: count(p => p.profile.draftYear !== null),
    draftRound: count(p => p.profile.draftRound !== null), draftType: count(p => p.profile.draftType != null),
    draftTeam: count(p => p.profile.draftTeamId != null), birthDate: count(p => p.profile.birthDate !== null),
    school: count(p => playerSchools(p).length > 0), history: count(p => !!p.profile.affiliations?.length) };
}
export function lifecycleQuery(params: URLSearchParams, catalog: NpbCatalog) {
  const mode = params.get("view") ?? "draft", role = params.get("role") ?? "all", period = params.get("period") ?? "season";
  const date = params.get("asOf") ?? catalog.effectiveDate, errors: string[] = [];
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) === date && date >= "1936-01-01" && date <= catalog.effectiveDate;
  if (!validDate) errors.push("年齢の基準日は有効な日付で、保存データ日までを指定してください。");
  const number = (key: string, min: number, max: number, fallback: number | null = null) => {
    const raw = params.get(key); if (raw === null || raw === "") return fallback;
    const n = Number(raw); if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < min || n > max) { errors.push(`${key}の条件を確認してください。`); return null; } return n;
  };
  const lastYear = Number(catalog.effectiveDate.slice(0,4));
  const year = number("year",1936,lastYear), from = number("from",1936,lastYear), to = number("to",1936,lastYear);
  const ageMin = number("ageMin",0,100), ageMax = number("ageMax",0,100,mode === "young" ? 25 : null), minimum = number("minimum",0,100000,0) ?? 0;
  if (from !== null && to !== null && from > to || ageMin !== null && ageMax !== null && ageMin > ageMax) errors.push("条件の下限は上限以下にしてください。");
  if (!["draft","young","school"].includes(mode) || !["all","batting","pitching"].includes(role) || !["season","7","14","30"].includes(period)) errors.push("指定した探索の種類・成績・期間は未対応です。");
  if (params.has("competition") && params.get("competition") !== "regular" || params.has("season") && params.get("season") !== String(lastYear)) errors.push("指定した競技・保存シーズンは未対応です。");
  const team = params.get("team") ?? "", draftTeam = params.get("draftTeam") ?? "";
  for (const id of [team,draftTeam]) if (id && !catalog.teams.some(t => t.teamId === id)) errors.push("指定した球団は確認できません。");
  const type = params.get("type") ?? "", position = params.get("position") ?? "", round = params.get("round") ?? "";
  if (type && !["regular","developmental","unknown"].includes(type)) errors.push("Draft区分を確認してください。");
  if (position && !catalog.players.some(p => p.profile.position === position)) errors.push("指定した主ポジションは確認できません。");
  if (round && round !== "unknown" && !catalog.players.some(p => p.profile.draftRound === round)) errors.push("指定した指名順位は確認できません。");
  if (minimum > 0 && role === "all") errors.push("最低サンプルを使う場合は打撃または投球を選んでください。");
  return { mode, role, period, date: validDate ? date : catalog.effectiveDate, errors, year, from, to, ageMin, ageMax, minimum,
    team, draftTeam, type, position, round, name: (params.get("q") ?? "").slice(0,100), school: (params.get("school") ?? "").slice(0,100), includeUnknown: params.get("unknown") === "1" };
}
export function lifecyclePlayers(catalog: NpbCatalog, query: ReturnType<typeof lifecycleQuery>, stats: readonly ExplorerRow[] = []) {
  if (query.errors.length) return [];
  const metrics = new Map(stats.map(p => [p.playerId,p]));
  const hasAgeCondition = query.mode === "young" || query.ageMin !== null || query.ageMax !== null;
  return catalog.players.filter(p => {
    const f = p.profile, age = ageOnDate(f.birthDate,query.date), schools = playerSchools(p);
    if (query.mode === "draft" && !query.includeUnknown && f.draftYear === null) return false;
    if (query.mode === "school" && !schools.length) return false;
    if (query.year !== null && f.draftYear !== query.year || query.from !== null && (f.draftYear === null || f.draftYear < query.from) || query.to !== null && (f.draftYear === null || f.draftYear > query.to)) return false;
    if (hasAgeCondition && (age === null || query.ageMin !== null && age < query.ageMin || query.ageMax !== null && age > query.ageMax)) return false;
    if (query.team && p.membership.teamId !== query.team || query.draftTeam && f.draftTeamId !== query.draftTeam) return false;
    if (query.round && (query.round === "unknown" ? f.draftRound !== null : f.draftRound !== query.round)) return false;
    if (query.type && (query.type === "unknown" ? f.draftType != null : f.draftType !== query.type)) return false;
    if (query.position && f.position !== query.position) return false;
    if (query.role === "batting" && !p.battingAvailable || query.role === "pitching" && !p.pitchingAvailable) return false;
    if (query.name && !normalizePlayerSearch(p.displayName).includes(normalizePlayerSearch(query.name))) return false;
    if (query.school && !schools.some(s => normalizePlayerSearch(s).includes(normalizePlayerSearch(query.school)))) return false;
    if (query.minimum > 0) {
      const values = query.role === "pitching" ? metrics.get(p.playerId)?.pitching : metrics.get(p.playerId)?.batting;
      const sample = readableMetric(values?.[query.role === "pitching" ? "outsRecorded" : "PA"]);
      if (sample === null || sample < query.minimum) return false;
    }
    return true;
  }).sort((a,b) => a.displayName.localeCompare(b.displayName,"ja") || a.playerId.localeCompare(b.playerId));
}
export function validateLifecycleStats(catalog: NpbCatalog, payload: { effectiveDate: string; players: {playerId:string;displayName:string;teamId:string|null}[] }) {
  const byId = new Map(catalog.players.map(p => [p.playerId,p]));
  if (catalog.effectiveDate !== payload.effectiveDate || payload.players.some(row => {
    const p = byId.get(row.playerId); return !p || p.displayName !== row.displayName || p.membership.teamId !== row.teamId;
  })) throw Error("Lifecycle/stat projection identity or effectiveDate mismatch");
}
