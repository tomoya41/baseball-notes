const keys = ["season", "competition", "period", "role", "battingView", "team", "minimum", "sample", "metric1", "op1", "value1", "metric2", "op2", "value2", "sort1", "dir1", "sort2", "dir2", "metrics", "recentPlayers", "recentMode", "player", "date", "asOfDate", "cohort", "peer", "age", "ageMode"];
import { canonicalEntityRefSchema } from "./cross-league";
import { npbComparisonOrigin } from "./npb-player-journey";
import { clubYearPair, progressionMetrics } from "./npb-player-progression";
import type { League } from "./models";
export function viewConditions(params: URLSearchParams, includeName = true, league?: League): string {
  const clean = new URLSearchParams();
  for (const key of [...keys, ...(includeName ? ["q"] : [])]) { const value = params.get(key); if (value && value.length <= 2000) clean.set(key, value); }
  if(league==="MLB"||!["birthYear","draftYear","schoolYear","ageSeason"].includes(clean.get("cohort")??"")){clean.delete("cohort");clean.delete("peer");}
  if(clean.get("cohort")!=="ageSeason"||!/^\d{1,2}$/.test(clean.get("age")??""))clean.delete("age");
  if(clean.get("cohort")!=="ageSeason"||!["season","collected"].includes(clean.get("ageMode")??""))clean.delete("ageMode");
  if(clean.has("peer")&&!canonicalEntityRefSchema.safeParse({league:"NPB",kind:"player",id:clean.get("peer")}).success)clean.delete("peer");
  if (includeName && league !== "MLB") {
    const origin = npbComparisonOrigin(params);
    if (origin) clean.set("fromSeason", origin.season);
    const pair = clubYearPair(params.get("clubYears"));
    const years = params.get("years"), metric = params.get("trendMetric");
    if (pair && years && /^20\d{2}(,20\d{2}){1,3}$/.test(years) &&
      pair.split(",").every(year => years.split(",").includes(year)) && !clean.has("cohort") &&
      (!params.has("competition") || params.get("competition") === "regular") && !params.has("stage") &&
      canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id: clean.get("player") }).success) {
      clean.set("years", years);
      clean.set("clubYears", pair);
      if (metric && progressionMetrics.some(key => key === metric)) clean.set("trendMetric", metric);
    }
  }
  // Local storage retains its legacy schema; public URLs additionally require
  // the route's league and canonical identities, never opaque/local IDs.
  if (league) {
    for (const key of ["team", "player"] as const) {
      const value = clean.get(key);
      if (value && !canonicalEntityRefSchema.safeParse({ league, kind: key, id: value }).success) clean.delete(key);
    }
    if (params.has("recentPlayers")) {
      const players = [...new Set((clean.get("recentPlayers") ?? "").split(",").filter(id => canonicalEntityRefSchema.safeParse({ league, kind: "player", id }).success))].slice(0, 12);
      if (players.length) clean.set("recentPlayers", players.join(",")); else clean.delete("recentPlayers");
      // Keep selected mode when invalid/empty selections are removed; never
      // turn a shared selection into an all-player Recent exploration.
      clean.set("recentMode", "selected");
    }
  }
  return clean.toString();
}
