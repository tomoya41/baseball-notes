import names from "../data/mlb-japanese-names.json";
import { normalizePlayerSearch } from "./cross-league";

const players: Readonly<Record<string, { en: string; ja: string }>> = names.players;
const teams: Readonly<Record<string, string>> = names.teams;

export function japaneseMlbPlayerName(id: string, original: string | null): string | null {
  return players[id]?.ja ?? original;
}
export function japaneseMlbTeamName(id: string, original: string): string {
  return teams[id] ?? original;
}
export function matchesMlbPlayerName(id: string, name: string, query: string): boolean {
  const normalize = (value: string) => normalizePlayerSearch(value).replace(/[\s・･.]/g, "");
  const needle = normalize(query);
  return [name, players[id]?.ja ?? "", players[id]?.en ?? ""].some(value => normalize(value).includes(needle));
}

type Named = { name: string | null; playerId?: string; id?: string };
const player = <T extends Named>(row: T): T => ({ ...row,
  name: japaneseMlbPlayerName(row.playerId ?? row.id ?? "", row.name) });

/** Presentation projection only: do not modify the validated source payload or any Fact. */
export function japaneseHistoricalPayload<T>(path: string, payload: T): T {
  const value = payload as Record<string, unknown>;
  if (path === "manifest.json") return { ...value,
    teams: (value.teams as { id: string; name: string }[]).map(row => ({ ...row, name: japaneseMlbTeamName(row.id, row.name) })),
  } as T;
  if (path === "players/index.json") return { ...value, players: (value.players as Named[]).map(player) } as T;
  if (path.startsWith("players/")) return { ...value, player: player(value.player as Named) } as T;
  if (path.startsWith("games/")) {
    const game = value.game as { batting: Named[]; pitching: Named[] };
    return { ...value, game: { ...game, batting: game.batting.map(player), pitching: game.pitching.map(player) } } as T;
  }
  if (path.startsWith("records/")) return { ...value,
    records: (value.records as { rows: Named[] }[]).map(record => ({ ...record, rows: record.rows.map(player) })),
  } as T;
  if (path.startsWith("advanced/") && path !== "advanced/capabilities.json") {
    const section = (key: string) => {
      const original = value[key] as { opponents: Named[] };
      return { ...original, opponents: original.opponents.map(player) };
    };
    return { ...value, batting: section("batting"), pitching: section("pitching") } as T;
  }
  return payload;
}
