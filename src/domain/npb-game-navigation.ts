import { canonicalEntityRefSchema } from "./cross-league";

export function npbScheduleTeam(params: URLSearchParams): string | undefined {
  const teams = params.getAll("team");
  return teams.length === 1 && canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "team", id: teams[0] }).success
    ? teams[0]
    : undefined;
}

export function npbSchedulePath(date?: string, team?: string): string {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (team) params.set("team", team);
  return `/NPB/schedule${params.size ? `?${params}` : ""}`;
}
