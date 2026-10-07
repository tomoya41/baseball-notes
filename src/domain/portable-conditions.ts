const keys = ["season", "competition", "period", "role", "team", "minimum", "sample", "metric1", "op1", "value1", "metric2", "op2", "value2", "sort1", "dir1", "sort2", "dir2", "metrics", "recentPlayers", "recentMode", "player", "date"];
import { canonicalEntityRefSchema } from "./cross-league";
import type { League } from "./models";
export function viewConditions(params: URLSearchParams, includeName = true, league?: League): string {
  const clean = new URLSearchParams();
  for (const key of [...keys, ...(includeName ? ["q"] : [])]) { const value = params.get(key); if (value && value.length <= 2000) clean.set(key, value); }
  // Local storage retains its legacy schema; public URLs additionally require
  // the route's league and canonical identities, never opaque/local IDs.
  if (league) {
    for (const key of ["team", "player"] as const) {
      const value = clean.get(key);
      if (value && !canonicalEntityRefSchema.safeParse({ league, kind: key, id: value }).success) clean.delete(key);
    }
    if (clean.has("recentPlayers")) {
      const players = [...new Set(clean.get("recentPlayers")!.split(",").filter(id => canonicalEntityRefSchema.safeParse({ league, kind: "player", id }).success))].slice(0, 12);
      if (players.length) clean.set("recentPlayers", players.join(",")); else clean.delete("recentPlayers");
      // Keep selected mode when invalid/empty selections are removed; never
      // turn a shared selection into an all-player Recent exploration.
      clean.set("recentMode", "selected");
    }
  }
  return clean.toString();
}
