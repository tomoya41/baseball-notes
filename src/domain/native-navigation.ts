import { canonicalEntityRefSchema, canonicalEntityPath } from "./cross-league";
export function canonicalDeepLink(input: string): string | null {
  try {
    const uri = new URL(input);
    if (uri.protocol !== "baseballnotes:" && !(uri.protocol === "https:" && uri.hostname === "tomoya41.github.io" &&
      uri.pathname.startsWith("/baseball-notes/"))) return null;
    const route = uri.protocol === "baseballnotes:" ? `/${uri.hostname}${uri.pathname}` :
      uri.hash.startsWith("#/") ? uri.hash.slice(1) : uri.pathname.replace(/^\/baseball-notes/, "");
    const [leagueRaw, resource, encoded, child, ...extra] = route.split("?")[0]!.replace(/^\//, "").split("/");
    if (extra.length || (child && !["analysis", "game-log"].includes(child))) return null;
    const league = leagueRaw?.toUpperCase();
    const kind = resource === "players" ? "player" : resource === "games" ? "game" : undefined;
    const parsed = canonicalEntityRefSchema.safeParse({ league, kind, id: decodeURIComponent(encoded ?? "") });
    if (!parsed.success || (child && kind !== "player")) return null;
    const sourceParams = new URLSearchParams(route.split("?")[1] ?? uri.search);
    const params = new URLSearchParams();
    for (const key of ["season", "date", "asOfDate"]) {
      const value = sourceParams.get(key); if (!value) continue;
      if (key === "season" ? /^20\d{2}$/.test(value) : /^20\d{2}-\d{2}-\d{2}$/.test(value)) params.set(key, value);
    }
    return `${canonicalEntityPath(parsed.data)}${child ? `/${child}` : ""}${params.size ? `?${params}` : ""}`;
  } catch { return null; }
}
export function parentNativeRoute(path: string): string | null {
  const segments = path.split("?")[0]!.split("/").filter(Boolean), league = segments[0] === "MLB" ? "MLB" : "NPB";
  if (segments[1] === "players" && segments.length > 3) return `/${league}/players/${segments[2]}`;
  if (segments[1] === "players") return `/${league}/search`;
  if (segments[1] === "games") return `/${league}/schedule`;
  if (segments[1] !== "home") return `/${league}/home`;
  return null;
}
