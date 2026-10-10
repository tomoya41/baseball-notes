/** Rule metadata only, never fabricated Game wins. Source: NPB 2026 info_cs.html (2026-10-10). */
export function npbCsFinal2026(evidence: { gamesBehind: number | null; wins: number | null; losses: number | null }) {
  const { gamesBehind, wins, losses } = evidence;
  if (gamesBehind !== null && (!Number.isFinite(gamesBehind) || gamesBehind < 0)) throw new Error("Invalid games behind");
  if ([wins, losses].some(value => value !== null && (!Number.isSafeInteger(value) || value < 0))) throw new Error("Invalid record");
  const pct = wins !== null && losses !== null && wins + losses > 0 ? wins / (wins + losses) : null;
  const extra = (gamesBehind !== null && gamesBehind >= 10) || (pct !== null && pct < .5);
  if (!extra && (gamesBehind === null || pct === null)) return null;
  return { advantageWins: extra ? 2 : 1, maximumPlayedGames: extra ? 7 : 6, winsRequired: extra ? 5 : 4 };
}
