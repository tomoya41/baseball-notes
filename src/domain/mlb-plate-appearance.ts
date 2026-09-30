export interface HistoricalPlateAppearance {
  id: string; league: "MLB"; gameId: string; season: number; sequence: number;
  inning: number; half: "top" | "bottom";
  battingTeamId: string; fieldingTeamId: string; batterId: string; pitcherId: string;
  outsBefore: number | null; baseStateBefore: number | null;
  battingOrder: number | null; battingScoreBefore: number | null; fieldingScoreBefore: number | null;
  result: string; isAtBat: number; hits: number; doubles: number; triples: number;
  homeRuns: number; walks: number; intentionalWalks: number; hbp: number; strikeouts: number;
  sacrificeHits: number; sacrificeFlies: number;
  substitutionDuringPa: boolean;
}

export const paCountFields = ["isAtBat", "hits", "doubles", "triples", "homeRuns", "walks", "hbp",
  "strikeouts", "sacrificeHits", "sacrificeFlies"] as const;
export type PaCountField = typeof paCountFields[number];
export type PaCounts = { PA: number } & Record<PaCountField, number>;
export const emptyPaCounts = (): PaCounts => ({ PA: 0, isAtBat: 0, hits: 0, doubles: 0, triples: 0,
  homeRuns: 0, walks: 0, hbp: 0, strikeouts: 0, sacrificeHits: 0, sacrificeFlies: 0 });
export function addPaCounts(total: PaCounts, row: HistoricalPlateAppearance): void {
  total.PA++;
  for (const field of paCountFields) total[field] += row[field];
}

export function situationKeys(row: HistoricalPlateAppearance, role: "batting" | "pitching" = "batting"): string[] {
  const keys = [`inning:${row.inning <= 3 ? "1–3" : row.inning <= 6 ? "4–6" : row.inning <= 9 ? "7–9" : "extra"}`];
  if (row.outsBefore !== null) keys.push(`outs:${row.outsBefore}`);
  if (row.baseStateBefore !== null) {
    keys.push(`bases:${row.baseStateBefore === 0 ? "empty" : "runners"}`);
    if ((row.baseStateBefore & 6) !== 0) keys.push("bases:risp");
  }
  if (row.battingScoreBefore !== null && row.fieldingScoreBefore !== null) {
    const own = role === "batting" ? row.battingScoreBefore : row.fieldingScoreBefore;
    const other = role === "batting" ? row.fieldingScoreBefore : row.battingScoreBefore;
    keys.push(`score:${own === other ? "tied" : own > other ? "ahead" : "behind"}`);
  }
  return keys;
}
