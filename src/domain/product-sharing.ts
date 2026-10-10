import { canonicalEntityRefSchema } from "./cross-league";
import { z } from "zod";
import { compareIds } from "./player-compare";
import { metricNumber, selectedTeams } from "./product-comparison";
import type { CompareMetrics } from "./player-compare";
import { viewConditions } from "./portable-conditions";
import type { League } from "./models";

export const PUBLIC_APP_URL = "https://tomoya41.github.io/baseball-notes/";
// Local IDs and unknown keys never travel through a shareable URL.
export function portableRoute(path: string, search = ""): string | null {
  const parts = path.split("/").filter(Boolean), league = parts[0];
  if (league !== "NPB" && league !== "MLB") return null;
  const resource = parts[1], source = new URLSearchParams(search), clean = new URLSearchParams();
  if (parts.length === 2 && ["data", "history"].includes(resource ?? "")) { const conditions = viewConditions(source, true, league); return `/${league}/${resource}${conditions ? `?${conditions}` : ""}`; }
  if (league === "MLB" && parts.length === 2 && ["matchup","milestones"].includes(resource ?? "")) {
    for (const key of ["batter","pitcher","player"]) {const id=source.get(key);if(id && canonicalEntityRefSchema.safeParse({league,kind:"player",id}).success)clean.set(key,id);}
    if(["batting","pitching"].includes(source.get("role") ?? ""))clean.set("role",source.get("role")!);
    if(resource === "milestones") {
      if(["near","achieved"].includes(source.get("mode") ?? ""))clean.set("mode",source.get("mode")!);
      if(["H","HR","RBI","SB","SO","W","SV"].includes(source.get("metric") ?? ""))clean.set("metric",source.get("metric")!);
    }
  } else if (parts.length === 2 && ["compare", "team-compare", "season-compare"].includes(resource ?? "")) {
    if (resource === "compare") {
      const ids = compareIds(league, source.get("players")); if (ids.length) clean.set("players", ids.join(","));
      for (const k of ["condition", "period", "role", "order"]) { const v = source.get(k); if (v && v.length < 200) clean.set(k, v); }
      const opponent = source.get("opponent"), against = source.get("against");
      if (opponent && canonicalEntityRefSchema.safeParse({ league, kind: "team", id: opponent }).success) clean.set("opponent", opponent);
      if (league === "MLB" && against && canonicalEntityRefSchema.safeParse({ league, kind: "player", id: against }).success) clean.set("against", against);
    } else if (resource === "team-compare") {
      const ids = selectedTeams(league, source.get("teams")); if (ids.length) clean.set("teams", ids.join(","));
      if (["season", "7", "14", "30", "home", "away"].includes(source.get("view") ?? "")) clean.set("view", source.get("view")!);
      if (/^[A-Za-z0-9]{1,20}$/.test(source.get("metric") ?? "")) clean.set("metric", source.get("metric")!);
    } else {
      const kind = source.get("kind") === "team" ? "team" : "player", entity = source.get("entity");
      if (entity && canonicalEntityRefSchema.safeParse({ league, kind, id: entity }).success) { clean.set("kind", kind); clean.set("entity", entity); }
      if (source.has("years") && (source.get("years") === "" || /^20\d{2}(,20\d{2}){0,5}$/.test(source.get("years")!))) clean.set("years", source.get("years")!);
      if (["batting", "pitching"].includes(source.get("role") ?? "")) clean.set("role", source.get("role")!);
      if (/^[A-Za-z0-9]{1,20}$/.test(source.get("metric") ?? "")) clean.set("metric", source.get("metric")!);
    }
  } else if (parts[1] === "postseason" && parts[2] === "series" && parts.length === 4 && /^mlb:series:[0-9a-f-]{36}$/i.test(decodeSafe(parts[3]!))) {
    if (league !== "MLB") return null;
  } else {
    const kind = resource === "players" ? "player" : resource === "teams" ? "team" : resource === "games" ? "game" : null;
    if (!kind || !canonicalEntityRefSchema.safeParse({ league, kind, id: decodeSafe(parts[2] ?? "") }).success || parts.length > (kind === "player" ? 4 : 3)) return null;
    if (parts[3] && !["stats", "analysis", "game-log", "trends", "more", "advanced"].includes(parts[3])) return null;
  }
  for (const k of ["season", "date", "asOfDate"]) { const v = source.get(k); if (v && (k === "season" ? /^20\d{2}$/.test(v) : /^20\d{2}-/.test(v) && z.iso.date().safeParse(v).success)) clean.set(k, v); }
  if (source.get("competition") === "postseason") clean.set("competition", "postseason");
  return `${path}${clean.size ? `?${clean}` : ""}`;
}
function decodeSafe(value: string) { try { return decodeURIComponent(value); } catch { return ""; } }
export function portableUrl(path: string, search = "") { const route = portableRoute(path, search); return route ? `${PUBLIC_APP_URL}#${route}` : null; }
export type DisplayExport = { league: League; scope: string; date: string; coverage: string; columns: string[]; rows: (string | number | null)[][] };
export function comparisonDisplayExport(league: League, scope: string, date: string, keys: string[], selections: { name: string; metrics: CompareMetrics | null; coverage: string }[]): DisplayExport {
  return { league, scope, date,
    coverage: selections.length > 0 && selections.every(r => r.coverage === "complete" && r.metrics && keys.every(k => metricNumber(r.metrics, k) !== null && r.metrics?.[k]?.status === "complete")) ? "complete" : "partial",
    columns: ["選手", ...keys], rows: selections.map(r => [r.name, ...keys.map(k => metricNumber(r.metrics, k))]) };
}
export const RETROSHEET_EXPORT_CREDIT = 'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "www.retrosheet.org".';
export function displayCsv(input: DisplayExport): string {
  if (input.league !== "MLB" || input.rows.length > 40 || input.columns.length > 20 || input.rows.some(r => r.length !== input.columns.length) || !/^20\d{2}-\d{2}-\d{2}$/.test(input.date)) throw Error("Bounded permitted MLB display export required");
  const cell = (v: string | number | null) => { const s = v === null ? "" : String(v); const safe = /^[\s]*[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s; return `"${safe.replaceAll('"', '""')}"`; };
  return [["Baseball Notes", input.scope, input.date, `Coverage: ${input.coverage}`], [RETROSHEET_EXPORT_CREDIT], ["Identity bridge: Chadwick Register — Open Data Commons Attribution License 1.0 https://github.com/chadwickbureau/register"], input.columns, ...input.rows].map(r => r.map(cell).join(",")).join("\r\n");
}
