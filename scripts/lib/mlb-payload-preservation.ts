import { isDeepStrictEqual } from "node:util";

/** Season rows are keyed by canonical identity; display order is not a Fact. */
export function equivalentHistoricalPayload(path: string, baseline: unknown, candidate: unknown): boolean {
  if (isDeepStrictEqual(baseline, candidate)) return true;
  if (!/^(postseason\/)?seasons\/\d{4}\.json\.gz$/.test(path)) return false;
  const normalize = (input: unknown) => {
    if (!input || typeof input !== "object" || !("players" in input) || !Array.isArray(input.players)) return null;
    const rows = input.players as { playerId?: unknown }[];
    if (rows.some(row => typeof row?.playerId !== "string") || new Set(rows.map(row => row.playerId)).size !== rows.length) return null;
    return { ...input, players: [...rows].sort((a, b) => (a.playerId as string).localeCompare(b.playerId as string)) };
  };
  const before = normalize(baseline), after = normalize(candidate);
  return before !== null && after !== null && isDeepStrictEqual(before, after);
}

export function protectedHistoricalPath(path: string): boolean {
  const scoped = path.replace(/^postseason\//, "");
  // Range/decade Records intentionally expand. Identity/profile union is audited separately.
  return /^(games|schedule|seasons|teams|chronology)\//.test(scoped) || /^records\/\d{4}\.json\.gz$/.test(scoped) || /^advanced\/(201[6-9]|202[0-5])\//.test(scoped);
}
