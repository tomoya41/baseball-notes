import { z } from "zod";
import type { PlayerGameBatting, PlayerGamePitching } from "./game-facts";
import { unavailablePeriodCoverage, type PeriodCoverage } from "./period-coverage";

// A baseball date is a JST calendar date, not an instant. The endpoint is inclusive.
export const playerPeriodQuerySchema = z.strictObject({
  playerId: z.string().min(1),
  asOfDate: z.iso.date(),
  period: z.enum(["7d", "14d", "30d"]),
});
export type PlayerPeriodQuery = z.infer<typeof playerPeriodQuerySchema>;
export type PeriodWindow = { from: string; to: string; timeZone: "Asia/Tokyo" };
export type AggregateStatus = "complete" | "partial" | "unavailable";
export type AggregateMetric = {
  value: number | null;
  status: AggregateStatus;
  observedFacts: number;
  factCount: number;
};

const periodDays: Record<PlayerPeriodQuery["period"], number> = { "7d": 7, "14d": 14, "30d": 30 };
export function resolvePlayerPeriod(input: PlayerPeriodQuery): PeriodWindow {
  const query = playerPeriodQuerySchema.parse(input);
  const day = new Date(`${query.asOfDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - periodDays[query.period] + 1);
  return { from: day.toISOString().slice(0, 10), to: query.asOfDate, timeZone: "Asia/Tokyo" };
}

function count(values: readonly (number | null | undefined)[]): AggregateMetric {
  const observed = values.filter((value): value is number => value != null);
  const status: AggregateStatus = values.length === 0 || observed.length === 0 ? "unavailable" :
    observed.length === values.length ? "complete" : "partial";
  return { value: status === "complete" ? observed.reduce((sum, value) => sum + value, 0) : null,
    status, observedFacts: observed.length, factCount: values.length };
}

function rate(inputs: readonly AggregateMetric[], formula: (values: number[]) => number | null): AggregateMetric {
  const factCount = inputs[0]?.factCount ?? 0;
  const observedFacts = inputs.length === 0 ? 0 : Math.min(...inputs.map((input) => input.observedFacts));
  if (inputs.some((input) => input.status === "unavailable"))
    return { value: null, status: "unavailable", observedFacts, factCount };
  if (inputs.some((input) => input.status === "partial"))
    return { value: null, status: "partial", observedFacts, factCount };
  const value = formula(inputs.map((input) => input.value!));
  return { value, status: value === null ? "unavailable" : "complete", observedFacts, factCount };
}

function statusOf(facts: number, metrics: Record<string, AggregateMetric>): AggregateStatus {
  return facts === 0 ? "unavailable" : Object.values(metrics).every((metric) => metric.status === "complete")
    ? "complete" : "partial";
}

export type PeriodResult<Metrics extends Record<string, AggregateMetric>> = PeriodWindow & {
  playerId: string;
  games: number;
  factCount: number;
  dataStatus: AggregateStatus;
  coverage: PeriodCoverage;
  calculatedAt: string;
  metrics: Metrics;
};

const battingFields = {
  PA: "pa", AB: "ab", R: "runs", H: "hits", "2B": "doubles", "3B": "triples",
  HR: "homeRuns", RBI: "rbi", BB: "walks", HBP: "hbp", SH: "sacrificeHits",
  SF: "sacrificeFlies", SO: "strikeouts", SB: "stolenBases", CS: "caughtStealing",
} as const satisfies Record<string, keyof PlayerGameBatting>;
export type BattingMetric = keyof typeof battingFields | "G" | "AVG" | "OBP" | "SLG" | "OPS";
export type BattingPeriodResult = PeriodResult<Record<BattingMetric, AggregateMetric>>;

export function aggregateBatting(query: PlayerPeriodQuery, facts: readonly PlayerGameBatting[], now = new Date(),
  coverage?: PeriodCoverage): BattingPeriodResult {
  const window = resolvePlayerPeriod(query);
  const rows = facts.filter((fact) => fact.playerId === query.playerId);
  const counts = {} as Record<keyof typeof battingFields, AggregateMetric>;
  for (const [name, field] of Object.entries(battingFields) as [keyof typeof battingFields, typeof battingFields[keyof typeof battingFields]][])
    counts[name] = count(rows.map((row) => row[field]));
  const avg = rate([counts.H, counts.AB], ([hits, ab]) => ab! > 0 ? hits! / ab! : null);
  const obp = rate([counts.H, counts.BB, counts.HBP, counts.AB, counts.SF],
    ([hits, bb, hbp, ab, sf]) => (ab! + bb! + hbp! + sf!) > 0 ? (hits! + bb! + hbp!) / (ab! + bb! + hbp! + sf!) : null);
  const slg = rate([counts.H, counts["2B"], counts["3B"], counts.HR, counts.AB],
    ([hits, doubles, triples, hr, ab]) => ab! > 0 && hits! >= doubles! + triples! + hr!
      ? (hits! + doubles! + 2 * triples! + 3 * hr!) / ab! : null);
  const ops = rate([obp, slg], ([onBase, slugging]) => onBase! + slugging!);
  const games = new Set(rows.map((row) => row.gameId)).size;
  const metrics: Record<BattingMetric, AggregateMetric> = { ...counts, G: count(Array.from({ length: games }, () => 1)),
    AVG: avg, OBP: obp, SLG: slg, OPS: ops };
  return { ...window, playerId: query.playerId, games, coverage: coverage ?? unavailablePeriodCoverage(window),
    factCount: rows.length, dataStatus: statusOf(rows.length, metrics), calculatedAt: now.toISOString(), metrics };
}

const pitchingFields = {
  outsRecorded: "inningsPitchedOuts", BF: "battersFaced", H: "hits", HR: "homeRuns",
  SO: "strikeouts", R: "runs", ER: "earnedRuns", pitchCount: "pitches",
  BB: "walks", walksAndHitByPitch: "walksAndHitBatters",
} as const satisfies Record<string, keyof PlayerGamePitching>;
export type PitchingMetric = keyof typeof pitchingFields | "G" | "GS" | "appearances" | "W" | "L" | "HLD" | "SV" | "ERA" | "K9" | "WHIP";
export type PitchingPeriodResult = PeriodResult<Record<PitchingMetric, AggregateMetric>>;

export function aggregatePitching(query: PlayerPeriodQuery, facts: readonly PlayerGamePitching[], now = new Date(),
  coverage?: PeriodCoverage): PitchingPeriodResult {
  const window = resolvePlayerPeriod(query);
  const rows = facts.filter((fact) => fact.playerId === query.playerId);
  const counts = {} as Record<keyof typeof pitchingFields, AggregateMetric>;
  for (const [name, field] of Object.entries(pitchingFields) as [keyof typeof pitchingFields, typeof pitchingFields[keyof typeof pitchingFields]][])
    counts[name] = count(rows.map((row) => row[field]));
  const games = new Set(rows.map((row) => row.gameId)).size;
  const g = count(Array.from({ length: games }, () => 1));
  const appearances = count(rows.map(() => 1));
  const gs = count(rows.map((row) => row.starter === null || row.starter === undefined ? null : Number(row.starter)));
  const decisions = Object.fromEntries((["W", "L", "HLD", "SV"] as const).map((key) => [key,
    count(rows.map((row) => row.decision == null ? null : Number(row.decision === ({ W: "win", L: "loss", HLD: "hold", SV: "save" } as const)[key]))) ])) as Record<"W" | "L" | "HLD" | "SV", AggregateMetric>;
  const era = rate([counts.ER, counts.outsRecorded], ([er, outs]) => outs! > 0 ? er! * 27 / outs! : null);
  const k9 = rate([counts.SO, counts.outsRecorded], ([so, outs]) => outs! > 0 ? so! * 27 / outs! : null);
  // WHIP requires standalone BB. nf3's BB+HBP combined count is never substituted.
  const whip = rate([counts.H, counts.BB, counts.outsRecorded],
    ([hits, walks, outs]) => outs! > 0 ? (hits! + walks!) * 3 / outs! : null);
  const metrics: Record<PitchingMetric, AggregateMetric> = { ...counts, G: g, appearances, GS: gs,
    ...decisions, ERA: era, K9: k9, WHIP: whip };
  return { ...window, playerId: query.playerId, games, factCount: rows.length,
    coverage: coverage ?? unavailablePeriodCoverage(window),
    dataStatus: statusOf(rows.length, metrics), calculatedAt: now.toISOString(), metrics };
}
