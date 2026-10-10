/** Preserve the selected record scope when opening its canonical player. */
export function mlbRecordPlayerRoute(input: { playerId: string; season: number; competition: "regular" | "postseason"; period?: { id: string; seasons: number[] }; role: string; metric: string }): string {
  if (input.period && input.period.id !== "range") {
    const query = new URLSearchParams({ kind: "player", entity: input.playerId, years: input.period.seasons.join(","), competition: input.competition, role: input.role === "pitching" ? "pitching" : "batting", metric: input.metric });
    return `/MLB/season-compare?${query}`;
  }
  const base = `/MLB/players/${encodeURIComponent(input.playerId)}`;
  return input.period ? `${base}/stats?competition=${input.competition}` : `${base}?season=${input.season}${input.competition === "postseason" ? "&competition=postseason" : ""}`;
}
