import cohort from "../data/mlb-japan-cohort.json";
// Presentation metadata only. Unknown citizenship never becomes a negative assertion.
const verified: Readonly<Record<string, string>> = cohort.players;
export function isVerifiedJapanPlayer(canonicalId: string): boolean {
  return Object.hasOwn(verified, canonicalId);
}
export function japanCohortEvidence(canonicalId: string): string | null {
  return verified[canonicalId] ?? null;
}
