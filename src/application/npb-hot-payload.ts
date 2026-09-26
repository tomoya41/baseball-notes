import { z } from "zod";
import type { PlayerPeriodBatchResult } from "./player-period-batch";
import { compareHotRankInputs, evaluateHotCandidates } from "./npb-hot-candidates";
import type { HotCandidate, HotCandidateMetadata, HotRankInputs } from "./npb-hot-candidates";

export const NPB_HOT_PAYLOAD_SCHEMA_VERSION = 1 as const;
const count = z.number().int().nonnegative();
const metric = z.number().finite().nonnegative();
const rankInputs = z.strictObject({ primary: metric, first: metric, second: metric,
  third: metric, playerId: z.string().min(1) });
const display = { displayName: z.string().min(1), teamId: z.string().min(1), teamName: z.string().min(1),
  position: z.string().min(1).optional() };
const common = { playerId: z.string().min(1), rank: z.number().int().positive(),
  reason: z.string().min(1), rankInputs, ...display };
const batterEntry = z.strictObject({ ...common, role: z.literal("batter"),
  primaryMetric: z.strictObject({ id: z.literal("OPS"), value: metric }),
  sample: z.strictObject({ games: count, pa: count, ab: count, hr: count }) });
const starterEntry = z.strictObject({ ...common, role: z.literal("starter"),
  primaryMetric: z.strictObject({ id: z.literal("ERA"), value: metric }),
  sample: z.strictObject({ appearances: count, starts: count, reliefAppearances: count,
    outsRecorded: count, bf: count.optional(), k9: metric }) });
const relieverEntry = z.strictObject({ ...common, role: z.literal("reliever"),
  primaryMetric: z.strictObject({ id: z.literal("ERA"), value: metric }),
  sample: z.strictObject({ appearances: count, starts: count, reliefAppearances: count,
    outsRecorded: count, bf: count.optional(), k9: metric }) });
const readinessReason = z.enum(["coverage_not_complete", "no_production_eligible_players",
  "category_not_ready", "scheduled_production_evidence_pending", "display_metadata_unavailable"]);
const category = z.strictObject({ status: z.enum(["ready", "not_ready"]), eligiblePlayers: count });

export const npbHotPayloadSchema = z.strictObject({
  schemaVersion: z.literal(NPB_HOT_PAYLOAD_SCHEMA_VERSION),
  league: z.literal("NPB"),
  generatedAt: z.iso.datetime(),
  effectiveDate: z.iso.date(),
  period: z.strictObject({ type: z.literal("7d"), from: z.iso.date(), to: z.iso.date() }),
  readiness: z.strictObject({ status: z.enum(["ready", "not_ready"]),
    scheduledProductionEvidence: z.boolean(), reasons: z.array(readinessReason),
    categories: z.strictObject({ batting: category, starters: category, relievers: category }) }),
  coverage: z.strictObject({ status: z.enum(["complete", "partial", "unknown", "unavailable"]),
    completePlayers: count, candidateCount: count,
    eligibleBatters: count, eligibleStarters: count, eligibleRelievers: count }),
  batting: z.array(batterEntry), starters: z.array(starterEntry), relievers: z.array(relieverEntry),
}).superRefine((payload, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  const day = new Date(`${payload.effectiveDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 6);
  if (payload.period.to !== payload.effectiveDate || payload.period.from !== day.toISOString().slice(0, 10))
    issue("HOT period must be seven inclusive JST calendar days ending at effectiveDate");
  const groups = { batting: payload.batting, starters: payload.starters, relievers: payload.relievers };
  const roles = { batting: "batter", starters: "starter", relievers: "reliever" } as const;
  for (const group of ["batting", "starters", "relievers"] as const) {
    const entries = groups[group];
    const seen = new Set<string>();
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!;
      if (entry.rank !== index + 1) issue(`${group} ranks must be sequential and unique`);
      if (seen.has(entry.playerId)) issue(`${group} has a duplicate player`);
      seen.add(entry.playerId);
      if (entry.rankInputs.playerId !== entry.playerId ||
        entry.rankInputs.primary !== entry.primaryMetric.value) issue(`${group} rank inputs mismatch`);
      const expectedReason = entry.role === "batter" ? `直近7日 OPS ${entry.primaryMetric.value.toFixed(3)}` :
        `直近7日 防御率 ${entry.primaryMetric.value.toFixed(2)}`;
      if (entry.reason !== expectedReason) issue(`${group} reason does not match primary metric`);
      if (index > 0 && compareHotRankInputs(entries[index - 1]!.rankInputs,
        entry.rankInputs, roles[group]) > 0) issue(`${group} ordering violates HOT rank inputs`);
    }
    const categoryReadiness = payload.readiness.categories[group];
    if ((categoryReadiness.eligiblePlayers > 0) !== (categoryReadiness.status === "ready"))
      issue(`${group} category readiness is inconsistent`);
    if (entries.length > categoryReadiness.eligiblePlayers) issue(`${group} exceeds eligible count`);
  }
  if (payload.readiness.status === "ready") {
    if (!payload.readiness.scheduledProductionEvidence || payload.coverage.status !== "complete" ||
      Object.values(payload.readiness.categories).some((entry) => entry.status !== "ready") ||
      Object.values(groups).some((entries) => entries.length === 0) || payload.readiness.reasons.length)
      issue("Ready HOT payload does not satisfy the production gate");
  } else if (Object.values(groups).some((entries) => entries.length > 0)) {
    issue("A not_ready HOT payload must not expose ranking entries");
  }
  if (payload.coverage.eligibleBatters !== payload.readiness.categories.batting.eligiblePlayers ||
    payload.coverage.eligibleStarters !== payload.readiness.categories.starters.eligiblePlayers ||
    payload.coverage.eligibleRelievers !== payload.readiness.categories.relievers.eligiblePlayers)
    issue("Coverage eligible counts differ from category readiness");
});
export type NpbHotPayload = z.infer<typeof npbHotPayloadSchema>;

function number(value: number | null): number {
  if (value === null || !Number.isFinite(value)) throw new Error("Eligible HOT rank input is not finite");
  return value;
}
function publicRankInputs(inputs: HotRankInputs) {
  return { primary: number(inputs.primary), first: number(inputs.first),
    second: number(inputs.second), third: number(inputs.third), playerId: inputs.playerId };
}
function displayFields(metadata?: HotCandidateMetadata) {
  return { ...(metadata?.displayName ? { displayName: metadata.displayName } : {}),
    ...(metadata?.teamId ? { teamId: metadata.teamId } : {}),
    ...(metadata?.teamName ? { teamName: metadata.teamName } : {}),
    ...(metadata?.position ? { position: metadata.position } : {}) };
}
function publicEntry(candidate: HotCandidate, rank: number) {
  if (candidate.eligibility !== "eligible" || candidate.role === "unclassified_pitcher")
    throw new Error("Excluded HOT candidate cannot be serialized as a ranked entry");
  const shared = { playerId: candidate.playerId, rank, reason: candidate.reason ?? "",
    rankInputs: publicRankInputs(candidate.rankInputs), ...displayFields(candidate.metadata) };
  if (candidate.role === "batter") return { ...shared, role: "batter" as const,
    primaryMetric: { id: "OPS" as const, value: number(candidate.primaryMetric.metric.value) },
    sample: { games: candidate.sample.games, pa: number(candidate.sample.pa), ab: number(candidate.sample.ab),
      hr: number(candidate.stats.metrics.HR.value) } };
  return { ...shared, role: candidate.role,
    primaryMetric: { id: "ERA" as const, value: number(candidate.primaryMetric.metric.value) },
    sample: { appearances: number(candidate.sample.appearances), starts: number(candidate.sample.starts),
      reliefAppearances: number(candidate.sample.reliefAppearances),
      outsRecorded: number(candidate.sample.outsRecorded), k9: number(candidate.stats.metrics.K9.value),
      ...(candidate.sample.bf !== null ? { bf: candidate.sample.bf } : {}) } };
}

export type NpbHotPayloadOptions = { generatedAt?: string; scheduledProductionEvidence: boolean;
  limit?: number; metadata?: ReadonlyMap<string, HotCandidateMetadata> };
export function buildNpbHotPayload(batch: PlayerPeriodBatchResult, options: NpbHotPayloadOptions):
  { payload: NpbHotPayload; timings: { hotEvaluationMs: number; projectionAndValidationMs: number } } {
  const started = performance.now();
  const limit = options.limit ?? 5;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("HOT payload limit must be positive");
  const hot = evaluateHotCandidates(batch, { limit,
    ...(options.metadata ? { metadata: options.metadata } : {}) });
  const hotEvaluationMs = performance.now() - started;
  const categories = {
    batting: { status: hot.productionGate.roleReady.batter ? "ready" : "not_ready",
      eligiblePlayers: hot.eligibleCounts.batter },
    starters: { status: hot.productionGate.roleReady.starter ? "ready" : "not_ready",
      eligiblePlayers: hot.eligibleCounts.starter },
    relievers: { status: hot.productionGate.roleReady.reliever ? "ready" : "not_ready",
      eligiblePlayers: hot.eligibleCounts.reliever },
  } as const;
  const reasons: z.infer<typeof readinessReason>[] = [];
  if (batch.coverage.status !== "complete") reasons.push("coverage_not_complete");
  const eligibleTotal = Object.values(hot.eligibleCounts).reduce((sum, value) => sum + value, 0);
  if (!eligibleTotal) reasons.push("no_production_eligible_players");
  else if (!hot.productionGate.ready) reasons.push("category_not_ready");
  if (!options.scheduledProductionEvidence) reasons.push("scheduled_production_evidence_pending");
  if (hot.productionGate.ready && [
    ...hot.top.batter, ...hot.top.starter, ...hot.top.reliever,
  ].some((candidate) => !candidate.metadata?.displayName || !candidate.metadata.teamId ||
    !candidate.metadata.teamName)) reasons.push("display_metadata_unavailable");
  const ready = reasons.length === 0;
  const completePlayers = new Set(hot.candidates.filter((candidate) => candidate.coverage.status === "complete")
    .map((candidate) => candidate.playerId)).size;
  const draft = { schemaVersion: NPB_HOT_PAYLOAD_SCHEMA_VERSION, league: "NPB" as const,
    generatedAt: options.generatedAt ?? new Date().toISOString(), effectiveDate: batch.window.to,
    period: { type: "7d" as const, from: batch.window.from, to: batch.window.to },
    readiness: { status: ready ? "ready" : "not_ready", scheduledProductionEvidence:
      options.scheduledProductionEvidence, reasons, categories },
    coverage: { status: batch.coverage.status, completePlayers, candidateCount: hot.candidates.length,
      eligibleBatters: hot.eligibleCounts.batter, eligibleStarters: hot.eligibleCounts.starter,
      eligibleRelievers: hot.eligibleCounts.reliever },
    batting: ready ? hot.top.batter.map((candidate, index) => publicEntry(candidate, index + 1)) : [],
    starters: ready ? hot.top.starter.map((candidate, index) => publicEntry(candidate, index + 1)) : [],
    relievers: ready ? hot.top.reliever.map((candidate, index) => publicEntry(candidate, index + 1)) : [],
  };
  const payload = npbHotPayloadSchema.parse(draft);
  return { payload, timings: { hotEvaluationMs,
    projectionAndValidationMs: performance.now() - started - hotEvaluationMs } };
}
