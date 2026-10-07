const keys = ["season", "competition", "period", "role", "team", "minimum", "sample", "metric1", "op1", "value1", "metric2", "op2", "value2", "sort1", "dir1", "sort2", "dir2", "metrics", "recentPlayers", "recentMode", "player", "date"];
export function viewConditions(params: URLSearchParams, includeName = true): string {
  const clean = new URLSearchParams();
  for (const key of [...keys, ...(includeName ? ["q"] : [])]) { const value = params.get(key); if (value && value.length <= 2000) clean.set(key, value); }
  return clean.toString();
}
