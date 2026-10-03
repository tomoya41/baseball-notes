// Derived read model only. A missing observation is never a zero or a streak break.
export type TrendBatting = { gameId: string; date: string; gameNumber: number | null;
  pa: number | null; ab: number | null; hits: number | null; doubles: number | null;
  triples: number | null; homeRuns: number | null; walks: number | null; hbp: number | null;
  sacrificeFlies: number | null };
export type TrendPitching = { gameId: string; date: string; gameNumber: number | null;
  outsRecorded: number | null; runs: number | null; earnedRuns: number | null; strikeouts: number | null };
export type Streak = { count: number | null; atLeast: boolean };
export function knownSum(values: readonly (number | null)[]): number | null {
  return !values.length || values.some(v => v === null) ? null : values.reduce<number>((a, b) => a + b!, 0);
}
export function rollingBatting(rows: readonly TrendBatting[]) {
  const sum = (field: keyof Pick<TrendBatting, "pa" | "ab" | "hits" | "doubles" | "triples" | "homeRuns" | "walks" | "hbp" | "sacrificeFlies">) => knownSum(rows.map(r => r[field]));
  const pa = sum("pa"), ab = sum("ab"), hits = sum("hits"), doubles = sum("doubles"), triples = sum("triples"), hr = sum("homeRuns"), bb = sum("walks"), hbp = sum("hbp"), sf = sum("sacrificeFlies");
  const avg = ab !== null && ab > 0 && hits !== null ? hits / ab : null;
  const obp = ab !== null && hits !== null && bb !== null && hbp !== null && sf !== null && ab + bb + hbp + sf > 0 ? (hits + bb + hbp) / (ab + bb + hbp + sf) : null;
  const slg = ab !== null && ab > 0 && hits !== null && doubles !== null && triples !== null && hr !== null && hits >= doubles + triples + hr ? (hits + doubles + triples * 2 + hr * 3) / ab : null;
  return { G: rows.length, PA: pa, AB: ab, H: hits, HR: hr, AVG: avg, OBP: obp, SLG: slg, OPS: obp !== null && slg !== null ? obp + slg : null };
}
function ordered<T extends { gameId: string; date: string; gameNumber: number | null }>(rows: readonly T[]) {
  const keys = new Set<string>();
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (keys.has(row.gameId)) return null;
    keys.add(row.gameId); const group = groups.get(row.date) ?? []; group.push(row); groups.set(row.date, group);
  }
  if ([...groups.values()].some(g => g.length > 1 && (g.some(r => r.gameNumber === null) || new Set(g.map(r => r.gameNumber)).size !== g.length))) return null;
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || (a.gameNumber ?? 0) - (b.gameNumber ?? 0));
}
function tailStreak<T>(rows: readonly T[], test: (row: T) => boolean | null, coverageComplete: boolean): Streak {
  if (!coverageComplete || !rows.length) return { count: null, atLeast: false };
  let count = 0;
  for (const row of [...rows].reverse()) { const value = test(row); if (value === null) return { count: null, atLeast: false }; if (!value) return { count, atLeast: false }; count++; }
  return { count, atLeast: true };
}
export function buildBattingTrends(input: readonly TrendBatting[], window: 5 | 10, coverageComplete: boolean) {
  // PA=0 substitutes are not counted as batting appearances; unknown PA blocks proof.
  const sorted = ordered(input.filter(row => row.pa !== 0));
  const rows = sorted ?? [];
  const positive = (field: "hits" | "homeRuns") => (r: TrendBatting) => r.pa === null || r[field] === null ? null : r[field]! > 0;
  return { ordered: sorted !== null, rows,
    hitting: tailStreak(rows, positive("hits"), coverageComplete),
    homeRuns: tailStreak(rows, positive("homeRuns"), coverageComplete),
    onBase: tailStreak(rows, r => r.pa === null || [r.hits, r.walks, r.hbp].some(v => v === null) ? null : r.hits! + r.walks! + r.hbp! > 0, coverageComplete),
    recent: rollingBatting(rows.slice(-window)),
    points: rows.map((r, i) => ({ date: r.date, gameId: r.gameId, ...rollingBatting(rows.slice(Math.max(0, i - window + 1), i + 1)), fullWindow: i + 1 >= window })),
  };
}
export function buildPitchingTrends(input: readonly TrendPitching[], coverageComplete: boolean) {
  const sorted = ordered(input), rows = sorted ?? [];
  return { ordered: sorted !== null, rows,
    scoreless: tailStreak(rows, r => r.runs === null ? null : r.runs === 0, coverageComplete),
    points: rows.map(r => ({ ...r, ERA: r.outsRecorded !== null && r.outsRecorded > 0 && r.earnedRuns !== null ? r.earnedRuns * 27 / r.outsRecorded : null })),
  };
}
