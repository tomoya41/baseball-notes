import { z } from "zod";
import {
  dataFreshnessSchema,
  leagueSchema,
  metricValueSchema,
  sourceSchema,
  timestampSchema,
} from "./models";

const id = z.string().min(1);
export const dateSchema = z.iso.date();
const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");
export const countStateSchema = z.strictObject({
  balls: z.number().int().min(0).max(3),
  strikes: z.number().int().min(0).max(2),
});
export type CountState = z.infer<typeof countStateSchema>;
export const baseStateSchema = z.enum([
  "all",
  "empty",
  "runners-on",
  "risp",
  "loaded",
]);
export type BaseState = z.infer<typeof baseStateSchema>;
export const periodSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("season"),
    year: z.number().int().min(1800).max(2200),
  }),
  z.strictObject({
    kind: z.literal("last-days"),
    days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  }),
  z.strictObject({ kind: z.enum(["current-month", "previous-month"]) }),
  z
    .strictObject({
      kind: z.literal("custom"),
      startDate: dateSchema,
      endDate: dateSchema,
    })
    .refine((p) => p.startDate <= p.endDate, "Reversed interval"),
]);
export const velocityBandSchema = z
  .strictObject({
    unit: z.enum(["mph", "km/h"]),
    minInclusive: z.number().nonnegative().nullable(),
    maxExclusive: z.number().positive().nullable(),
  })
  .refine(
    (b) =>
      (b.minInclusive !== null || b.maxExclusive !== null) &&
      (b.minInclusive === null ||
        b.maxExclusive === null ||
        b.minInclusive < b.maxExclusive),
    "Invalid velocity band",
  );
export const inningRangeSchema = z.strictObject({
  from: z.number().int().positive(),
  through: z.number().int().positive().nullable(),
}).refine((value) => value.through === null || value.from <= value.through, "Reversed innings");
export const scoreDifferentialSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("all") }),
  z.strictObject({ kind: z.literal("bucket"), value: z.enum([
    "lead-3-plus", "lead-1-2", "tied", "trail-1-2", "trail-3-plus",
  ]) }),
  // Runs from the subject team's perspective at the start of the PA.
  z.strictObject({ kind: z.literal("exact"), runs: z.number().int() }),
]);
// Adapter output for one observed PA context. Raw game inning, the pitcher's
// inning within this appearance, and times through order are never aliases.
export const gameSituationSchema = z.strictObject({
  gameInning: z.number().int().positive(),
  appearanceInning: z.number().int().positive().nullable(),
  battingOrder: z.number().int().min(1).max(9).nullable(),
  scoreDifferentialRuns: z.number().int().nullable(),
  scorePerspective: z.enum(["batting-team", "pitching-team"]),
  observedAt: z.literal("plate-appearance-start"),
});
export type GameSituation = z.infer<typeof gameSituationSchema>;
const countFilterSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum([
      "all",
      "first-pitch",
      "pitcher-ahead",
      "batter-ahead",
      "two-strikes",
      "full-count",
    ]),
  }),
  z.strictObject({ kind: z.literal("exact"), state: countStateSchema }),
]);
export const analysisQuerySchema = z
  .strictObject({
    version: z.literal(2),
    league: leagueSchema,
    subject: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.enum(["batter", "pitcher"]), playerId: id }),
      z.strictObject({
        kind: z.literal("matchup"),
        pitcherId: id,
        batterId: id,
      }),
    ]),
    // Reference day in the provider's baseball calendar; yesterday is the last permitted day.
    asOfDate: dateSchema,
    timeZone,
    period: periodSchema,
    seasonType: z.enum(["regular", "postseason", "preseason"]),
    population: z.enum([
      "plate-appearances",
      "batters-faced",
      "plate-appearance-reached-count",
      "pitch-at-count",
    ]),
    metricIds: z
      .array(id)
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate metric"),
    groupBy: z.enum([
      "none",
      "handedness",
      "home-away",
      "batting-order",
      "score-differential",
      "game-inning",
      "appearance-inning",
      "count",
      "bases",
      "outs",
      "pitch-type",
      "catcher",
      "velocity",
      "zone",
      "batted-ball",
    ]),
    filters: z.strictObject({
      opponent: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("all") }),
        z.strictObject({
          kind: z.literal("handedness"),
          hand: z.enum(["R", "L"]),
        }),
        z.strictObject({ kind: z.enum(["pitcher", "batter"]), playerId: id }),
      ]),
      bases: baseStateSchema,
      outs: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable(),
      count: countFilterSchema,
      pitchType: id.nullable(),
      velocity: velocityBandSchema.nullable(),
      catcherId: id.nullable(),
      homeAway: z.enum(["all", "home", "away"]),
      battingOrder: z.number().int().min(1).max(9).nullable(),
      scoreDifferential: scoreDifferentialSchema,
      gameInning: inningRangeSchema.nullable(),
      appearanceInning: inningRangeSchema.nullable(),
    }),
  })
  .superRefine((q, ctx) => {
    if (q.filters.count.kind !== "all" && !["plate-appearance-reached-count", "pitch-at-count"].includes(q.population))
      ctx.addIssue({
        code: "custom",
        message: "Count requires explicit reached-PA or pitch population",
      });
    if (q.groupBy === "count" && !["plate-appearance-reached-count", "pitch-at-count"].includes(q.population))
      ctx.addIssue({
        code: "custom",
        message: "Count grouping requires explicit population",
      });
    if (q.subject.kind === "batter" && q.filters.opponent.kind === "batter")
      ctx.addIssue({ code: "custom", message: "A batter faces pitchers" });
    if (q.subject.kind === "pitcher" && q.filters.opponent.kind === "pitcher")
      ctx.addIssue({ code: "custom", message: "A pitcher faces batters" });
    if (q.subject.kind === "matchup" && q.filters.opponent.kind !== "all")
      ctx.addIssue({
        code: "custom",
        message: "Matchup already specifies both opponents",
      });
    if (q.subject.kind === "batter" && q.filters.appearanceInning !== null)
      ctx.addIssue({ code: "custom", message: "Appearance inning is pitcher-only" });
    if (q.subject.kind === "pitcher" && q.filters.battingOrder !== null)
      ctx.addIssue({ code: "custom", message: "Batting order is batter-only" });
    if (q.subject.kind !== "matchup" && q.groupBy === "appearance-inning" && q.subject.kind !== "pitcher")
      ctx.addIssue({ code: "custom", message: "Appearance inning is pitcher-only" });
    if (q.groupBy === "batting-order" && q.subject.kind === "pitcher")
      ctx.addIssue({ code: "custom", message: "Batting order is batter-only" });
  });
export type AnalysisQuery = z.infer<typeof analysisQuerySchema>;

export const capabilityIds = [
  "basicStats",
  "recentForm",
  "monthlySplit",
  "dateRange",
  "handednessSplit",
  "homeAwaySplit",
  "battingOrderSplit",
  "scoreDifferentialSplit",
  "gameInningSplit",
  "appearanceInningSplit",
  "countSplit",
  "baseSplit",
  "outsSplit",
  "pitchTypeSplit",
  "matchup",
  "directMatchup",
  "pitchTypeMatchup",
  "countMatchup",
  "recentMatchup",
  "pitchMix",
  "pitchVelocity",
  "spinRate",
  "pitchMovement",
  "catcherSplit",
  "statcast",
  "heatmap",
  "battedBall",
  "sprintSpeed",
  "framing",
  "blocking",
  "popTime",
  "armStrength",
] as const;
export const capabilityIdSchema = z.enum(capabilityIds);
export type CapabilityId = z.infer<typeof capabilityIdSchema>;
export const analysisCapabilitySchema = z.object({
  status: z.enum([
    "available",
    "conditional",
    "unavailable",
    "prohibited",
    "research",
  ]),
  implementation: z.enum(["implemented", "not-implemented"]),
  reason: id,
  evidence: z.array(z.string().min(1)).min(1),
});
export type AnalysisCapability = z.infer<typeof analysisCapabilitySchema>;
export const capabilityManifestSchema = z.object({
  providerId: id,
  league: leagueSchema,
  revision: id,
  subjects: z.array(z.enum(["batter", "pitcher", "matchup"])),
  seasonTypes: z.array(z.enum(["regular", "postseason", "preseason"])),
  coverage: z
    .object({ from: dateSchema, through: dateSchema })
    .refine((c) => c.from <= c.through, "Reversed coverage")
    .nullable(),
  features: z.record(capabilityIdSchema, analysisCapabilitySchema),
  metricRequirements: z.record(z.string(), z.array(capabilityIdSchema)),
  periods: z.array(
    z.enum([
      "season",
      "last-days",
      "current-month",
      "previous-month",
      "custom",
    ]),
  ),
  populations: z.array(
    z.enum([
      "plate-appearances",
      "batters-faced",
      "plate-appearance-reached-count",
      "pitch-at-count",
    ]),
  ),
  // Exact permitted feature combinations; individually supported filters are not automatically composable.
  supportedCombinations: z.array(z.array(capabilityIdSchema)),
});
export type AnalysisCapabilities = z.infer<typeof capabilityManifestSchema>;
export const sampleUnitSchema = z.enum([
  "PA",
  "AB",
  "BF",
  "pitches",
  "swings",
  "outside-zone-pitches",
  "BBE",
  "outs",
  "matchups",
  "appearances",
]);
export const sampleSizeSchema = z.partialRecord(
  sampleUnitSchema,
  z.number().int().nonnegative().nullable(),
);
export type SampleSize = z.infer<typeof sampleSizeSchema>;
export const samplePolicySchema = z.object({
  revision: id,
  rules: z.record(
    z.string(),
    z.object({
      unit: sampleUnitSchema,
      warnBelow: z.number().int().nonnegative(),
    }),
  ),
});
export type SamplePolicy = z.infer<typeof samplePolicySchema>;
export function sampleWarning(
  size: SampleSize,
  context: string,
  policy: SamplePolicy,
): string | null {
  const rule = policy.rules[context];
  if (!rule) throw new Error("Unknown sample policy context");
  const count = size[rule.unit];
  if (count == null) return "母数が不明のため評価できません";
  return count < rule.warnBelow ? "サンプルが少ないため参考値" : null;
}

// Metadata only in Analysis A. No raw pitch/event ingestion or coordinate transforms.
export const coordinateDefinitionSchema = z.object({
  systemId: id,
  version: id,
  units: z.enum(["feet", "inches", "meters", "source-plot"]),
  viewpoint: z.enum(["catcher", "pitcher", "source-defined"]),
  plane: z.enum(["front-of-plate", "middle-of-plate", "batted-ball-plot"]),
  zoneDefinition: id,
});
export type CoordinateDefinition = z.infer<typeof coordinateDefinitionSchema>;
export function canCompareCoordinates(
  a: CoordinateDefinition,
  b: CoordinateDefinition,
): boolean {
  return (
    a.systemId === b.systemId &&
    a.version === b.version &&
    a.units === b.units &&
    a.viewpoint === b.viewpoint &&
    a.plane === b.plane &&
    a.zoneDefinition === b.zoneDefinition
  );
}
export const splitSchema = z.object({
  key: id,
  label: id,
  sampleSize: sampleSizeSchema,
  metrics: z.array(
    z.object({
      definitionId: id,
      definitionVersion: id,
      value: metricValueSchema,
      denominator: z.object({
        unit: sampleUnitSchema,
        count: z.number().int().nonnegative().nullable(),
        population: id,
      }),
      sourceUnit: z.enum(["mph", "km/h", "rpm", "in", "cm", "ft", "m"]).optional(),
      comparison: z.object({
        population: id,
        season: z.number().int().min(1800).max(2200),
        sampleSize: sampleSizeSchema,
        // Same definition and sourceUnit as the measured metric.
        leagueAverage: z.number().finite().nullable(),
        percentile: z.number().min(0).max(100).nullable(),
      }).nullable().optional(),
    }),
  ),
  warnings: z.array(z.string()),
});
export type Split = z.infer<typeof splitSchema>;
const analysisSnapshotSchema = z.object({
  query: analysisQuerySchema,
  source: sourceSchema,
  aggregationVersion: id,
  aggregatedAt: timestampSchema,
  coverage: z
    .object({
      startDate: dateSchema,
      endDate: dateSchema,
      completeThrough: dateSchema,
      timeZone,
      completeness: z.enum(["complete", "partial"]),
    })
    .refine(
      (c) => c.startDate <= c.endDate && c.completeThrough >= c.endDate,
      "Incomplete coverage must not claim later dates",
    ),
  freshness: dataFreshnessSchema,
  coordinates: coordinateDefinitionSchema.nullable(),
  warnings: z.array(z.string()),
});
export const analysisResultSchema = z
  .discriminatedUnion("status", [
    analysisSnapshotSchema.extend({
      status: z.literal("data"),
      splits: z.array(splitSchema).min(1),
    }),
    analysisSnapshotSchema.extend({
      status: z.literal("empty"),
      splits: z.array(splitSchema).length(0),
      reason: id,
    }),
    z.object({
      status: z.enum(["unavailable", "not-implemented", "error"]),
      reason: id,
      query: analysisQuerySchema,
    }),
  ])
  .superRefine((result, ctx) => {
    if (result.status !== "data" && result.status !== "empty") return;
    if (
      result.coverage.completeThrough >= result.query.asOfDate ||
      result.coverage.timeZone !== result.query.timeZone
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid previous-day cutoff or timezone",
      });
    if (result.query.groupBy === "zone" && result.coordinates === null)
      ctx.addIssue({
        code: "custom",
        message: "Zone results require coordinate definition",
      });
  });
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
