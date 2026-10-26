import { canonicalEntityRefSchema, canonicalEntityPath } from "./cross-league";
import { portableRoute } from "./product-sharing";
import { z } from "zod";
import japanPin from "../data/npb-japan-series-release.json";
export function canonicalDeepLink(input: string): string | null {
  try {
    const uri = new URL(input);
    if (uri.protocol !== "baseballnotes:" && !(uri.protocol === "https:" && uri.hostname === "tomoya41.github.io" &&
      uri.pathname.startsWith("/baseball-notes/"))) return null;
    const route = uri.protocol === "baseballnotes:" ? `/${uri.hostname}${uri.pathname}` :
      uri.hash.startsWith("#/") ? uri.hash.slice(1) : uri.pathname.replace(/^\/baseball-notes/, "");
    const [portablePath, portableSearch] = route.split("?");
    if(portablePath === "/NPB/schedule") {
      const source = new URLSearchParams(portableSearch ?? uri.search);
      if(source.has("stage")||source.has("competition")&&source.get("competition")!=="regular")return null;
      const date=source.get("date");
      if(date!==null&&!z.iso.date().safeParse(date).success)return null;
      return `/NPB/schedule${date ? `?date=${date}` : ""}`;
    }
    const expanded = ["data", "history", "compare", "team-compare", "season-compare", "postseason", "matchup", "milestones", "form", "cs", "moves", "weekly", "monthly"].includes(portablePath?.split("/")[2] ?? "");
    if (expanded || portablePath === "/NPB/talent/2026") return portableRoute(portablePath!, portableSearch ?? uri.search);
    const [leagueRaw, resource, encoded, child, ...extra] = route.split("?")[0]!.replace(/^\//, "").split("/");
    const teamPlayers = child === "players" && resource === "teams" && leagueRaw?.toUpperCase() === "NPB";
    if (extra.length || (child && !["analysis", "game-log", "stats", "more", "trends", "advanced"].includes(child) && !(child === "seasons" && leagueRaw?.toUpperCase() === "NPB") && !teamPlayers)) return null;
    const league = leagueRaw?.toUpperCase();
    const kind = resource === "players" ? "player" : resource === "games" ? "game" : resource === "teams" ? "team" : undefined;
    const parsed = canonicalEntityRefSchema.safeParse({ league, kind, id: decodeURIComponent(encoded ?? "") });
    if (!parsed.success || (child && kind !== "player" && !teamPlayers)) return null;
    const sourceParams = new URLSearchParams(route.split("?")[1] ?? uri.search);
    if (teamPlayers) return portableRoute(`${canonicalEntityPath(parsed.data)}/players`, sourceParams.toString());
    if(league==="NPB"&&kind==="game"&&(sourceParams.get("competition")==="postseason"||japanPin.gameIds.includes(parsed.data.id)))return portableRoute(canonicalEntityPath(parsed.data),sourceParams.toString());
    if(child === "seasons")return portableRoute(`${canonicalEntityPath(parsed.data)}/seasons`,sourceParams.toString());
    const params = new URLSearchParams();
    for (const key of ["season", "date", "asOfDate"]) {
      const value = sourceParams.get(key); if (!value) continue;
      if (key === "season" ? /^20\d{2}$/.test(value) : /^20\d{2}-/.test(value) && z.iso.date().safeParse(value).success) params.set(key, value);
    }
    if (league === "MLB" && sourceParams.get("competition") === "postseason") params.set("competition", "postseason");
    return `${canonicalEntityPath(parsed.data)}${child ? `/${child}` : ""}${params.size ? `?${params}` : ""}`;
  } catch { return null; }
}
export function parentNativeRoute(path: string): string | null {
  const segments = path.split("?")[0]!.split("/").filter(Boolean), league = segments[0] === "MLB" ? "MLB" : "NPB";
  const source = new URLSearchParams(path.split("?")[1]), scope = new URLSearchParams();
  if (league === "MLB" && source.get("competition") === "postseason") {
    scope.set("competition", "postseason");
  }
  if (league === "MLB" && /^20\d{2}$/.test(source.get("season") ?? "")) scope.set("season", source.get("season")!);
  const suffix = scope.size ? `?${scope}` : "";
  if (league === "NPB" && segments[1] === "teams" && segments[3] === "players") return `/NPB/teams/${segments[2]}`;
  if(league==="NPB"&&segments[1]==="talent"&&segments[2]==="2026")return "/NPB/talent";
  if(league==="NPB"&&segments[1]==="games"){
    try{if(japanPin.gameIds.includes(decodeURIComponent(segments[2]??"")))return "/NPB/postseason?season=2026&stage=japan_series";}catch{/* Invalid encoding follows the safe generic parent. */}
  }
  if(league==="NPB"&&segments[1]==="games"&&source.get("competition")==="postseason"){
    if(source.get("stage")==="japan_series")return "/NPB/postseason?season=2026&stage=japan_series";
    const stage=source.get("stage");return `/NPB/cs?season=2026${stage==="npb_cs_first"||stage==="npb_cs_final"?`&stage=${stage}`:""}`;
  }
  if(league==="NPB"&&segments[1]==="games"&&(!source.has("competition")||source.get("competition")==="regular")&&!source.has("stage")){
    const date=source.get("date");
    if(date&&z.iso.date().safeParse(date).success)return `/NPB/schedule?date=${date}`;
  }
  if(league==="NPB"&&segments[1]==="players"&&segments[3]==="seasons") {
    if (source.get("season") === "2026") {
      const stage = source.get("stage"), role = source.get("role");
      if (source.get("competition") === "postseason" && (stage === "npb_cs_first" || stage === "npb_cs_final")) {
        const cs = new URLSearchParams({ season: "2026", stage });
        if (role === "batting" || role === "pitching") cs.set("role", role);
        return `/NPB/cs?${cs}`;
      }
      return `/NPB/players/${segments[2]}`;
    }
    const history=new URLSearchParams({player:segments[2]!});
    if(/^20\d{2}$/.test(source.get("season")??""))history.set("season",source.get("season")!);
    return `/NPB/history?${history}`;
  }
  if (segments[1] === "watch-center") return `/${league}/my`;
  if (league === "NPB" && segments[1] === "moves") {
    const player = source.get("player"), team = source.get("team");
    if (canonicalEntityRefSchema.safeParse({ league, kind: "player", id: player }).success) return `/NPB/players/${player}`;
    if (canonicalEntityRefSchema.safeParse({ league, kind: "team", id: team }).success) return `/NPB/teams/${team}`;
  }
  if (segments[1] === "library" && segments.length > 2) return `/${league}/library`;
  if (["compare", "team-compare", "season-compare", "matchup"].includes(segments[1] ?? "")) return `/${league}/search${suffix}`;
  if (segments[1] === "players" && segments.length > 3) return `/${league}/players/${segments[2]}${suffix}`;
  if (segments[1] === "players") return `/${league}/search${suffix}`;
  if (segments[1] === "games") return `/${league}/schedule${suffix}`;
  if (segments[1] === "teams" && segments.length > 2) return `/${league}/teams${suffix}`;
  if (segments[1] === "postseason" && segments.length > 2) return `/${league}/postseason${source.get("season")?.match(/^20\d{2}$/) ? `?season=${source.get("season")}` : ""}`;
  if (segments[1] !== "home") return `/${league}/home`;
  return null;
}
