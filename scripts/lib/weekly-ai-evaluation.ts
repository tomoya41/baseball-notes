import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalEntityRefSchema } from "../../src/domain/cross-league";
import { AiCandidateRejection } from "../../src/domain/ai-candidate";
import { FORM_POLICY } from "../../src/domain/historical-form";
import { calendarWeek } from "../../src/domain/weekly-analysis";
import { validateWeeklyAiSelection, type WeeklyAiInput } from "../../src/data/weekly-ai-insights";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const dateRange = z.strictObject({ from: z.iso.date(), to: z.iso.date() });
const reasons = ["batting_impact", "pitching_impact", "week_improvement", "close_finish", "scoring_burst", "team_scoring"] as const;
const context = z.strictObject({ category: z.enum(["batting", "starters", "relievers"]), metricId: z.enum(["OPS", "ERA"]), sampleMetricId: z.enum(["PA", "outsRecorded"]), improvesWhen: z.enum(["higher", "lower"]) });
const evidenceCandidate = z.strictObject({ ref: z.string().regex(/^C[1-9]\d?$/), label: z.string().min(1).max(120), reason: z.enum(reasons), metrics: z.record(z.string().min(1).max(30), z.number().finite()), context: context.optional() });
const payload = z.strictObject({ schemaVersion: z.literal(1), scope: z.strictObject({ league: z.enum(["MLB", "NPB"]), season: z.number().int(), competition: z.enum(["regular", "postseason"]), stage: z.string().max(30).optional() }), week: dateRange.extend({ previous: dateRange }), coverage: z.enum(["complete", "partial", "unavailable"]), asOf: z.iso.date(), candidates: z.array(evidenceCandidate).max(20), requiredMetrics: z.strictObject(Object.fromEntries(reasons.map(reason => [reason, z.array(z.string().min(1).max(30)).min(1).max(6)])) as Record<typeof reasons[number], z.ZodArray<z.ZodString>>) });
const evidence = z.strictObject({ inputSha256: sha, payload, candidates: z.array(evidenceCandidate.extend({ subjectId: z.string().max(60) })).max(20), attribution: z.string().min(1).max(2000), sourceFingerprint: sha.nullable() });
const required = { batting_impact: ["OPS", "PA"], pitching_impact: ["ERA", "outsRecorded", "SO", "G"], week_improvement: ["delta", "previous", "current", "previousSample", "sample"], close_finish: ["runMargin", "homeRuns", "awayRuns"], scoring_burst: ["homeRuns", "awayRuns"], team_scoring: ["runsPerGame", "G"] } as const;
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

/** Offline replay of admitted evidence. It never contacts an AI, provider or DB. */
export function inspectWeeklyAiEvidence(value: unknown): WeeklyAiInput {
  const parsed = evidence.safeParse(value);
  if (!parsed.success) throw Error("INVALID_EVALUATION_EVIDENCE");
  // The digest binds the original serialized field order; schema parsing must
  // not silently reorder the caller's canonical subject mapping before hashing.
  const input = value as WeeklyAiInput, p = input.payload;
  const computed = createHash("sha256").update(JSON.stringify({ version: "weekly-selection-v1", payload: p, candidates: input.candidates, sourceFingerprint: input.sourceFingerprint })).digest("hex");
  if (computed !== input.inputSha256) throw Error("EVALUATION_HASH_MISMATCH");
  const week = calendarWeek(p.week.from);
  if (JSON.stringify(p.week) !== JSON.stringify(week) || p.asOf < p.week.to || Number(p.week.to.slice(0, 4)) !== p.scope.season ||
    p.scope.league === "MLB" && (p.scope.season < 2014 || p.scope.season > 2025 || p.scope.stage !== undefined || !input.sourceFingerprint) ||
    p.scope.league === "NPB" && p.scope.season !== 2026 ||
    JSON.stringify(p.requiredMetrics) !== JSON.stringify(required) ||
    JSON.stringify(p.candidates) !== JSON.stringify(input.candidates.map(c => ({ ref: c.ref, label: c.label, reason: c.reason, metrics: c.metrics, ...(c.context ? { context: c.context } : {}) })))) throw Error("EVALUATION_SCOPE_MISMATCH");
  const refs = new Set<string>();
  for (const c of input.candidates) {
    const entity = canonicalEntityRefSchema.safeParse({ league: p.scope.league, kind: c.subjectId.split(":")[1], id: c.subjectId });
    const player = ["batting_impact", "pitching_impact", "week_improvement"].includes(c.reason);
    if (!entity.success || refs.has(c.ref) || required[c.reason].some(k => c.metrics[k] === undefined) ||
      player && (entity.data.kind !== "player" || p.scope.league !== "MLB" || p.coverage !== "complete") ||
      !player && entity.data.kind !== (c.reason === "team_scoring" ? "team" : "game")) throw Error("EVALUATION_IDENTITY_OR_GATE_MISMATCH");
    refs.add(c.ref);
    const m = c.metrics;
    if (Object.entries(m).some(([key, n]) => key !== "delta" && n < 0)) throw Error("EVALUATION_METRIC_MISMATCH");
    if (player) {
      const ctx = c.context;
      if (!ctx || ctx.metricId !== (ctx.category === "batting" ? "OPS" : "ERA") || ctx.sampleMetricId !== (ctx.category === "batting" ? "PA" : "outsRecorded") || ctx.improvesWhen !== (ctx.category === "batting" ? "higher" : "lower") || c.reason === "batting_impact" && ctx.category !== "batting" || c.reason === "pitching_impact" && ctx.category === "batting") throw Error("EVALUATION_CONTEXT_MISMATCH");
      const policy = FORM_POLICY[ctx.category], minimum = policy.minimum[7];
      if (c.reason === "week_improvement") {
        if (m.sample! < minimum || m.previousSample! < minimum || !Number.isSafeInteger(m.sample) || !Number.isSafeInteger(m.previousSample) || !near(m.current! - m.previous!, m.delta!) || (ctx.category === "batting" ? m.delta! < 0.1 : m.delta! > -1)) throw Error("EVALUATION_COMPARISON_MISMATCH");
      } else if (m[policy.sample]! < minimum || !Number.isSafeInteger(m[policy.sample]) || ctx.category !== "batting" && (m.G! < (ctx.category === "starters" ? 1 : 2) || !Number.isSafeInteger(m.G) || !Number.isSafeInteger(m.SO))) throw Error("EVALUATION_SAMPLE_MISMATCH");
    } else if (c.reason === "team_scoring") {
      if (!Number.isSafeInteger(m.G) || m.G! < 1 || m.runsFor === undefined || !Number.isSafeInteger(m.runsFor) || !near(m.runsFor / m.G!, m.runsPerGame!)) throw Error("EVALUATION_TEAM_MISMATCH");
    } else if (![m.homeRuns, m.awayRuns].every(Number.isSafeInteger) || c.reason === "close_finish" && (m.runMargin! > 1 || m.runMargin !== Math.abs(m.homeRuns! - m.awayRuns!)) || c.reason === "scoring_burst" && Math.max(m.homeRuns!, m.awayRuns!) < 10) throw Error("EVALUATION_GAME_MISMATCH");
  }
  return input;
}

type EvaluationCase = { id: string; outcome: "PASS" | "FAIL"; expected: string; observed: string };

/** Control responses are deliberately program-built, never reported as model output. */
export function evaluateWeeklyAiOffline(value: unknown) {
  const input = inspectWeeklyAiEvidence(value), cases: EvaluationCase[] = [];
  const check = (id: string, expected: string, run: () => string) => {
    let observed: string;
    try { observed = run(); } catch (error) { observed = error instanceof AiCandidateRejection ? error.code : error instanceof z.ZodError ? "SCHEMA_MISMATCH" : "CONTROL_REJECTED"; }
    cases.push({ id, outcome: observed === expected ? "PASS" : "FAIL", expected, observed });
  };
  for (const c of input.candidates) {
    check(`bind_${c.ref}`, "EXACT_EVIDENCE_BOUND", () => {
      const response = { picks: [{ candidateRef: c.ref, reason: c.reason, metricIds: required[c.reason] }] };
      const a = validateWeeklyAiSelection(response, input), b = validateWeeklyAiSelection(response, input), pick = a.picks[0]!;
      return a.publiclyAdmitted === false && a.narrativeReviewRequired && a.inputSha256 === input.inputSha256 && pick.subjectId === c.subjectId && pick.label === c.label && required[c.reason].every(k => pick.metrics[k] === c.metrics[k]) && JSON.stringify(a) === JSON.stringify(b) ? "EXACT_EVIDENCE_BOUND" : "BINDING_MISMATCH";
    });
  }
  const first = input.candidates[0];
  if (first) {
    const valid = { candidateRef: first.ref, reason: first.reason, metricIds: [...required[first.reason]] };
    const reject = (id: string, expected: string, value: unknown) => check(id, expected, () => { validateWeeklyAiSelection(value, input); return "ACCEPTED"; });
    reject("unknown_candidate", "UNKNOWN_CANDIDATE", { picks: [{ ...valid, candidateRef: "C99" }] });
    reject("unknown_metric", "UNSUPPORTED_METRIC", { picks: [{ ...valid, metricIds: [...valid.metricIds, "invented"] }] });
    reject("missing_required_metric", "UNSUPPORTED_METRIC", { picks: [{ ...valid, metricIds: valid.metricIds.slice(1) }] });
    reject("duplicate_metric", "UNSUPPORTED_METRIC", { picks: [{ ...valid, metricIds: [...valid.metricIds, valid.metricIds[0]] }] });
    reject("wrong_reason", "UNSUPPORTED_REASON", { picks: [{ ...valid, reason: first.reason === "team_scoring" ? "close_finish" : "team_scoring" }] });
    reject("duplicate_subject", "DUPLICATE_SELECTION", { picks: [valid, valid] });
    reject("unreviewed_narrative", "SCHEMA_MISMATCH", { picks: [valid], explanation: "not admitted" });
    reject("model_recalculates_values", "SCHEMA_MISMATCH", { picks: [{ ...valid, values: { invented: 999 } }] });
    reject("empty_selection", "SCHEMA_MISMATCH", { picks: [] });
    reject("unbounded_selection", "SCHEMA_MISMATCH", { picks: [valid, valid, valid, valid] });
  }
  return { schemaVersion: 1, mode: "OFFLINE_CONTROL_REPLAY", inputSha256: input.inputSha256, sourceFingerprint: input.sourceFingerprint, scope: input.payload.scope, week: input.payload.week, coverage: input.payload.coverage, candidates: input.candidates.length, cases, passed: cases.filter(c => c.outcome === "PASS").length, failed: cases.filter(c => c.outcome === "FAIL").length,
    evidenceBinding: "CHECKED", controlReproducibility: input.candidates.length ? "CHECKED" : "NOT_RUN_NO_CANDIDATES", modelSelectionQuality: "NOT_EVALUATED", humanReview: { factualMeaning: "NOT_RUN", usefulness: "NOT_RUN", japanese: "NOT_RUN" },
    limitations: ["Controls are program-built, not real model responses.", "Bound evidence does not independently prove source statistics or editorial usefulness.", "Prior pitcher appearance counts are not included in selection input; eligibility remains the upstream Form evaluator's responsibility."],
    adoption: "HOLD_MODEL_QUALITY_UNPROVEN", publiclyAdmitted: false, aiRequests: 0, providerRequests: 0, canonicalWrites: 0, additionalMonthlyCostYen: 0 } as const;
}
