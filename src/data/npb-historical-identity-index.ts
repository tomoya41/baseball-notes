import registry from "./npb-historical-only-identities.json";

/** Metadata only: no season facts and no claim of current registration. */
export const historicalOnlyPlayers = new Map(registry.players.map(p=>[p.playerId,p]));
export const isHistoricalOnlyPlayer = (id:string) => historicalOnlyPlayers.has(id);
export function historicalPlayerRoute(id:string) {
  const seasons:Record<string,number[]>=registry.seasons;
  return `/NPB/history?season=${seasons[id]?.[0]??2015}&player=${encodeURIComponent(id)}`;
}
