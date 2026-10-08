import { canonicalEntityRefSchema, canonicalEntityPath } from "./cross-league";
import { portableRoute } from "./product-sharing";
import { z } from "zod";
export function canonicalDeepLink(input: string): string | null {
  try {
    const uri = new URL(input);
    if (uri.protocol !== "baseballnotes:" && !(uri.protocol === "https:" && uri.hostname === "tomoya41.github.io" &&
      uri.pathname.startsWith("/baseball-notes/"))) return null;
    const route = uri.protocol === "baseballnotes:" ? `/${uri.hostname}${uri.pathname}` :
      uri.hash.startsWith("#/") ? uri.hash.slice(1) : uri.pathname.replace(/^\/baseball-notes/, "");
    const [portablePath, portableSearch] = route.split("?");
    const expanded = ["data", "history", "compare", "team-compare", "season-compare", "postseason"].includes(portablePath?.split("/")[2] ?? "");
    if (expanded) return portableRoute(portablePath!, portableSearch ?? uri.search);
    const [leagueRaw, resource, encoded, child, ...extra] = route.split("?")[0]!.replace(/^\//, "").split("/");
    if (extra.length || (child && !["analysis", "game-log", "stats", "more", "trends", "advanced"].includes(child))) return null;
    const league = leagueRaw?.toUpperCase();
    const kind = resource === "players" ? "player" : resource === "games" ? "game" : resource === "teams" ? "team" : undefined;
    const parsed = canonicalEntityRefSchema.safeParse({ league, kind, id: decodeURIComponent(encoded ?? "") });
    if (!parsed.success || (child && kind !== "player")) return null;
    const sourceParams = new URLSearchParams(route.split("?")[1] ?? uri.search);
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
  if (segments[1] === "watch-center") return `/${league}/my`;
  if (segments[1] === "library" && segments.length > 2) return `/${league}/library`;
  if (["compare", "team-compare", "season-compare"].includes(segments[1] ?? "")) return `/${league}/search${suffix}`;
  if (segments[1] === "players" && segments.length > 3) return `/${league}/players/${segments[2]}${suffix}`;
  if (segments[1] === "players") return `/${league}/search${suffix}`;
  if (segments[1] === "games") return `/${league}/schedule${suffix}`;
  if (segments[1] === "teams" && segments.length > 2) return `/${league}/teams${suffix}`;
  if (segments[1] === "postseason" && segments.length > 2) return `/${league}/postseason${source.get("season")?.match(/^20\d{2}$/) ? `?season=${source.get("season")}` : ""}`;
  if (segments[1] !== "home") return `/${league}/home`;
  return null;
}
