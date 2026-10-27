import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readMlbWeekly } from "../src/application/mlb-weekly";
import { prepareWeeklyAiInput } from "../src/data/weekly-ai-insights";
import { inspectWeeklyAiEvidence, evaluateWeeklyAiOffline } from "../scripts/lib/weekly-ai-evaluation";
import { weeklyFixture } from "./fixtures/weekly-analysis";

async function setup() {
  const fixture = weeklyFixture();
  return prepareWeeklyAiInput(await readMlbWeekly(fixture.manifest, 2025, "2025-09-22", "regular", fixture.read));
}
function rehash(input: Awaited<ReturnType<typeof setup>>) {
  input.payload.candidates = input.candidates.map(c => ({ ref: c.ref, label: c.label, reason: c.reason, metrics: c.metrics, ...(c.context ? { context: c.context } : {}) }));
  input.inputSha256 = createHash("sha256").update(JSON.stringify({ version: "weekly-selection-v1", payload: input.payload, candidates: input.candidates, sourceFingerprint: input.sourceFingerprint })).digest("hex");
  return input;
}

describe("offline AI evaluation", () => {
  it("replays all supplied evidence and adversarial responses without claiming model quality or adoption", async () => {
    const input = await setup(), result = evaluateWeeklyAiOffline(input);
    expect(inspectWeeklyAiEvidence(input)).toBe(input);
    expect(result).toEqual(evaluateWeeklyAiOffline(JSON.parse(JSON.stringify(input))));
    expect(result.failed).toBe(0);
    expect(result.cases).toHaveLength(input.candidates.length + 10);
    expect(result.passed).toBe(result.cases.length);
    expect(result).toMatchObject({ mode: "OFFLINE_CONTROL_REPLAY", aiRequests: 0, providerRequests: 0, canonicalWrites: 0, publiclyAdmitted: false, adoption: "HOLD_MODEL_QUALITY_UNPROVEN", modelSelectionQuality: "NOT_EVALUATED", humanReview: { factualMeaning: "NOT_RUN", usefulness: "NOT_RUN", japanese: "NOT_RUN" } });
    const empty = structuredClone(input); empty.candidates = [];
    expect(evaluateWeeklyAiOffline(rehash(empty))).toMatchObject({ cases: [], passed: 0, controlReproducibility: "NOT_RUN_NO_CANDIDATES", publiclyAdmitted: false });
  });

  it("fails closed on body mutation, altered canonical binding, malformed shape and oversized sets", async () => {
    const input = await setup();
    for (const change of [
      () => { input.candidates[0]!.metrics.OPS = 9; },
      () => { input.candidates[0]!.subjectId = input.candidates[1]!.subjectId; },
    ]) {
      const original = structuredClone(input); change();
      expect(() => inspectWeeklyAiEvidence(input)).toThrow("EVALUATION_HASH_MISMATCH");
      Object.assign(input, original);
    }
    expect(() => inspectWeeklyAiEvidence({ ...input, untrusted: "do not execute" })).toThrow("INVALID_EVALUATION_EVIDENCE");
    expect(() => inspectWeeklyAiEvidence({ ...input, candidates: Array.from({ length: 21 }, () => input.candidates[0]) })).toThrow("INVALID_EVALUATION_EVIDENCE");
  });

  it("independently rejects under-sample eligibility, wrong pitcher direction and missing context even with a matching hash", async () => {
    const input = await setup(), batter = input.candidates.find(c => c.reason === "batting_impact")!;
    batter.metrics.PA = 19;
    expect(() => inspectWeeklyAiEvidence(rehash(input))).toThrow("EVALUATION_SAMPLE_MISMATCH");
    const old = await setup(), rising = old.candidates.find(c => c.reason === "week_improvement" && c.context?.category === "starters")!;
    rising.metrics.current = 9; rising.metrics.previous = 0; rising.metrics.delta = 9;
    expect(() => inspectWeeklyAiEvidence(rehash(old))).toThrow("EVALUATION_COMPARISON_MISMATCH");
    const missing = await setup(); delete missing.candidates[0]!.context;
    expect(() => inspectWeeklyAiEvidence(rehash(missing))).toThrow("EVALUATION_CONTEXT_MISMATCH");
  });

  it("requires exact calendar weeks, truthful game/team arithmetic, matching league IDs and NPB gates", async () => {
    const wrongWeek = await setup(); wrongWeek.payload.week.to = "2025-09-29";
    expect(() => inspectWeeklyAiEvidence(rehash(wrongWeek))).toThrow("EVALUATION_SCOPE_MISMATCH");
    const incorrect = await setup(), game = incorrect.candidates.find(c => c.reason === "close_finish")!;
    game.metrics.runMargin = 0;
    expect(() => inspectWeeklyAiEvidence(rehash(incorrect))).toThrow("EVALUATION_GAME_MISMATCH");
    const teams = await setup(); teams.candidates.find(c => c.reason === "team_scoring")!.metrics.runsPerGame = 99;
    expect(() => inspectWeeklyAiEvidence(rehash(teams))).toThrow("EVALUATION_TEAM_MISMATCH");
    const foreign = await setup(); foreign.candidates[0]!.subjectId = foreign.candidates.find(c => c.reason === "team_scoring")!.subjectId;
    expect(() => inspectWeeklyAiEvidence(rehash(foreign))).toThrow("EVALUATION_IDENTITY_OR_GATE_MISMATCH");
    const gated = await setup(); gated.payload.coverage = "partial";
    expect(() => inspectWeeklyAiEvidence(rehash(gated))).toThrow("EVALUATION_IDENTITY_OR_GATE_MISMATCH");
    const npb = await setup(); npb.payload.scope.league = "NPB"; npb.payload.scope.season = 2026; npb.payload.week = { from: "2026-09-21", to: "2026-09-27", previous: { from: "2026-09-14", to: "2026-09-20" } }; npb.payload.asOf = "2026-09-27";
    expect(() => inspectWeeklyAiEvidence(rehash(npb))).toThrow("EVALUATION_IDENTITY_OR_GATE_MISMATCH");
  });
});
