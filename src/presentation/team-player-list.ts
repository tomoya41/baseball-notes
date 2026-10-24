import type { NpbCatalog } from "../domain/npb-product-contract";
import type { NpbSeasonPayload } from "../application/npb-season-payload";
import type { NpbHistoricalDataset } from "../domain/npb-historical";

export type TeamPlayer = { id: string; name: string; number: string | null; numberDate: string | null;
  position: string | null; batting: boolean; pitching: boolean; battingGames: number | null;
  pitchingGames: number | null; outs: number | null; partial: boolean };
export type TeamPlayerRole = "all" | "batting" | "pitching";
export type TeamPlayerSort = "number" | "games" | "innings" | "name";

export function teamPlayerReturnPath(state: unknown): string | null {
  if (!state || typeof state !== "object" || !("teamPlayers" in state)) return null;
  const source = state.teamPlayers;
  if (!source || typeof source !== "object" || !("teamId" in source) || typeof source.teamId !== "string" || !/^npb:team:[a-z]+$/.test(source.teamId)) return null;
  const params = new URLSearchParams();
  for (const [field, key] of [["year", "season"], ["role", "role"], ["sort", "sort"], ["query", "q"]] as const) {
    const value = (source as Record<string, unknown>)[field];
    if (typeof value === "string") params.set(key, value);
  }
  return `/NPB/teams/${encodeURIComponent(source.teamId)}/players?${params}`;
}

/** Latest stored affiliation, not a live registration roster or team-split season total. */
export function currentTeamPlayers(catalog: NpbCatalog, season: NpbSeasonPayload | null, teamId: string): TeamPlayer[] {
  if (season && season.effectiveDate !== catalog.effectiveDate) throw Error("Roster/season publication dates differ");
  const stats = new Map(season?.players.map(p => [p.playerId, p]) ?? []);
  return catalog.players.filter(p => p.membership.teamId === teamId).map(p => {
    const s = stats.get(p.playerId), membership = p.membership;
    const numbered = membership.uniformNumber !== null && /^\d{1,3}$/.test(membership.uniformNumber) &&
      membership.uniformNumberEffectiveDate?.slice(0, 4) === catalog.effectiveDate.slice(0, 4) && !!membership.uniformNumberObservedAt &&
      membership.uniformNumberEffectiveDate <= catalog.effectiveDate && membership.uniformNumberObservedAt <= catalog.generatedAt;
    return { id: p.playerId, name: p.displayName, number: numbered ? membership.uniformNumber : null,
      numberDate: numbered ? membership.uniformNumberEffectiveDate : null, position: p.profile.position,
      batting: p.battingAvailable || !!s?.batting, pitching: p.pitchingAvailable || !!s?.pitching,
      battingGames: s?.batting?.metrics.G?.value ?? null, pitchingGames: s?.pitching?.metrics.G?.value ?? null,
      outs: s?.pitching?.metrics.outsRecorded?.value ?? null,
      partial: !!s && [s.batting?.metrics.G, s.pitching?.metrics.G, s.pitching?.metrics.outsRecorded].some(m => m?.status === "partial") };
  });
}

/** Only the selected year's actual team rows; never borrow a current uniform number. */
export function historicalTeamPlayers(data: { players: Pick<NpbHistoricalDataset["players"][number], "playerId" | "name">[]; rows: NpbHistoricalDataset["rows"] }, teamId: string, year: number): TeamPlayer[] {
  const rows = data.rows.filter(r => r.teamId === teamId && r.season === year);
  return data.players.filter(p => rows.some(r => r.playerId === p.playerId)).map(p => {
    const batting = rows.find(r => r.playerId === p.playerId && r.role === "batting");
    const pitching = rows.find(r => r.playerId === p.playerId && r.role === "pitching");
    return { id: p.playerId, name: p.name, number: null, numberDate: null, position: null,
      batting: !!batting, pitching: !!pitching, battingGames: batting?.metrics.G ?? null,
      pitchingGames: pitching?.metrics.G ?? null, outs: pitching?.metrics.outsRecorded ?? null, partial: false };
  });
}

export function sortTeamPlayers(players: readonly TeamPlayer[], role: TeamPlayerRole, sort: TeamPlayerSort): TeamPlayer[] {
  const value = (p: TeamPlayer) => sort === "number" ? p.number === null ? null : Number(p.number) :
    sort === "innings" ? p.outs : role === "pitching" ? p.pitchingGames : p.battingGames;
  return players.filter(p => role === "all" || p[role]).slice().sort((a, b) => {
    const av = value(a), bv = value(b);
    const metric = sort === "name" ? 0 : av === null ? bv === null ? 0 : 1 : bv === null ? -1 : (sort === "number" ? av - bv : bv - av);
    return metric || (sort === "number" && a.number !== null && b.number !== null ? a.number.localeCompare(b.number) : 0) ||
      a.name.localeCompare(b.name, "ja") || a.id.localeCompare(b.id);
  });
}
