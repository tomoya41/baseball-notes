import { mkdtemp, readFile, readdir, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildNpbHotPayload, npbHotPayloadSchema } from "../src/application/npb-hot-payload";
import type { PlayerPeriodBatchResult } from "../src/application/player-period-batch";
import { writeNpbHotPayloadAtomically } from "../src/data/npb-hot-payload";
import { aggregateBatting, aggregatePitching } from "../src/domain/player-period";
import type { BattingPeriodResult, PitchingPeriodResult } from "../src/domain/player-period";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";

const window = { from: "2026-09-18", to: "2026-09-24", timeZone: "Asia/Tokyo" as const };
const generatedAt = "2026-09-25T03:00:00.000Z";
const source = { sourceKey: "nf3", sourceRecordId: "fixture", collectedAt: generatedAt };
const coverage = (status: "complete" | "unknown" = "complete") =>
  ({ ...unavailablePeriodCoverage(window), status });
function batter(id: string, ops: number, status: "complete" | "unknown" = "complete"): BattingPeriodResult {
  const fact = playerGameBattingSchema.parse({ ...source, gameId: id, playerId: id,
    teamId: "T", opponentTeamId: "G", battingOrder: 1, pa: 28, ab: 24, runs: 3,
    hits: 8, doubles: 1, triples: 0, homeRuns: 2, rbi: 3, walks: 3, hbp: 1,
    sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 3, stolenBases: null,
    caughtStealing: null, starter: true });
  const result = aggregateBatting({ playerId: id, asOfDate: window.to, period: "7d" },
    [fact], new Date(generatedAt), coverage(status));
  return { ...result, metrics: { ...result.metrics, OPS: { ...result.metrics.OPS, value: ops } } };
}
function pitcher(id: string, role: "starter" | "reliever", era: number): PitchingPeriodResult {
  const appearances = role === "starter" ? 1 : 2;
  const facts = Array.from({ length: appearances }, (_, index) => playerGamePitchingSchema.parse({
    ...source, id: `${id}:${index}`, gameId: `${id}:${index}`, playerId: id,
    teamId: "T", opponentTeamId: "G", role,
    starter: role === "starter", appearanceOrder: null,
    inningsPitchedOuts: role === "starter" ? 18 : 3, battersFaced: 8,
    hits: 1, homeRuns: 0, walks: null, hitBatters: null, walksAndHitBatters: 1,
    strikeouts: 2, runs: 0, earnedRuns: 0, pitches: 22, catcherId: null, decision: "none",
  }));
  const result = aggregatePitching({ playerId: id, asOfDate: window.to, period: "7d" },
    facts, new Date(generatedAt), coverage());
  return { ...result, metrics: { ...result.metrics, ERA: { ...result.metrics.ERA, value: era } } };
}
function batch(batters: BattingPeriodResult[], pitchers: PitchingPeriodResult[],
  status: "complete" | "unknown" = "complete"): PlayerPeriodBatchResult {
  return { period: "7d", window, coverage: coverage(status), batters, pitchers,
    summary: { batterPlayers: batters.length, pitcherPlayers: pitchers.length,
      uniquePlayers: new Set([...batters, ...pitchers].map((row) => row.playerId)).size,
      battingFacts: batters.length, pitchingFacts: pitchers.length,
      coverage: { complete: 0, partial: 0, unknown: 0, unavailable: 0 } },
    timings: { dbReadMs: 0, aggregationMs: 0, totalMs: 0 } };
}
function readyBatch() {
  return batch(Array.from({ length: 6 }, (_, i) => batter(`b${i}`, 1.4 - i * .1)), [
    ...Array.from({ length: 6 }, (_, i) => pitcher(`s${i}`, "starter", i * .2)),
    ...Array.from({ length: 6 }, (_, i) => pitcher(`r${i}`, "reliever", i * .2)),
  ]);
}
function create(value: PlayerPeriodBatchResult, scheduledProductionEvidence = true) {
  return buildNpbHotPayload(value, { scheduledProductionEvidence, generatedAt }).payload;
}
function altered(value: unknown, mutate: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(value) as Record<string, unknown>;
  mutate(draft);
  return draft;
}

describe("versioned NPB HOT static payload", () => {
  it("keeps public lists empty while coverage and scheduled evidence are missing", () => {
    const payload = create(batch([batter("b", 1.2, "unknown")], [], "unknown"), false);
    expect(payload).toMatchObject({ schemaVersion: 1, league: "NPB", effectiveDate: "2026-09-24",
      generatedAt, period: { type: "7d", from: "2026-09-18", to: "2026-09-24" },
      readiness: { status: "not_ready", reasons: ["coverage_not_complete", "no_production_eligible_players",
        "scheduled_production_evidence_pending"] },
      coverage: { candidateCount: 1, completePlayers: 0 } });
    expect([payload.batting, payload.starters, payload.relievers]).toEqual([[], [], []]);
  });

  it("projects Top 5 per role with stable order, visible samples, and no raw Facts or WHIP", () => {
    const data = readyBatch();
    const metadata = new Map([["b0", { displayName: "打者A", teamId: "T", position: "外野手" }]]);
    const payload = buildNpbHotPayload(data, { generatedAt, scheduledProductionEvidence: true,
      metadata }).payload;
    expect(payload.readiness.status).toBe("ready");
    expect(payload.readiness.categories).toMatchObject({ batting: { status: "ready", eligiblePlayers: 6 },
      starters: { status: "ready", eligiblePlayers: 6 },
      relievers: { status: "ready", eligiblePlayers: 6 } });
    expect(payload.batting.map((row) => row.playerId)).toEqual(["b0", "b1", "b2", "b3", "b4"]);
    expect(payload.starters.map((row) => row.playerId)).toEqual(["s0", "s1", "s2", "s3", "s4"]);
    expect(payload.relievers.map((row) => row.playerId)).toEqual(["r0", "r1", "r2", "r3", "r4"]);
    expect(payload.batting.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(payload.batting[0]).toMatchObject({ displayName: "打者A", teamId: "T", position: "外野手",
      primaryMetric: { id: "OPS", value: 1.4 }, sample: { games: 1, pa: 28, ab: 24 },
      reason: "直近7日 OPS 1.400" });
    expect(payload.starters[0]).toMatchObject({ role: "starter", primaryMetric: { id: "ERA", value: 0 },
      sample: { appearances: 1, starts: 1, outsRecorded: 18 }, reason: "直近7日 防御率 0.00" });
    expect(payload.relievers[0]).toMatchObject({ role: "reliever", sample: { appearances: 2,
      reliefAppearances: 2, outsRecorded: 6 } });
    const text = JSON.stringify(payload);
    expect(text).not.toContain("WHIP");
    expect(text).not.toContain("authToken");
    expect(text).not.toContain("sourceRecordId");
    expect(text).not.toContain("pitchCount");
    expect(text).not.toContain("secret-token-fixture");
    expect(npbHotPayloadSchema.parse(payload)).toEqual(payload);
    const reordered = { ...data, batters: [...data.batters].reverse(), pitchers: [...data.pitchers].reverse() };
    expect(JSON.stringify(buildNpbHotPayload(reordered, { generatedAt,
      scheduledProductionEvidence: true, metadata }).payload)).toBe(text);
  });

  it("keeps mixed categories diagnostic-only until all three role gates are ready", () => {
    const payload = create(batch([batter("b", 1.2)], [pitcher("s", "starter", .75)]));
    expect(payload.readiness).toMatchObject({ status: "not_ready", reasons: ["category_not_ready"],
      categories: { batting: { status: "ready" }, starters: { status: "ready" },
        relievers: { status: "not_ready" } } });
    expect([payload.batting, payload.starters, payload.relievers]).toEqual([[], [], []]);
  });

  it("rejects duplicate players, bad ranks or ordering, malformed dates, null and unknown secret fields", () => {
    const valid = create(readyBatch());
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => { draft.schemaVersion = 2; })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => { draft.generatedAt = "2026-09-24"; })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => { draft.effectiveDate = "2026-09-25"; })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => {
      const rows = draft.batting as Array<Record<string, unknown>>;
      rows[1]!.playerId = rows[0]!.playerId;
    })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => {
      const rows = draft.batting as Array<Record<string, unknown>>;
      rows[1]!.rank = 1;
    })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => {
      const rows = draft.batting as Array<Record<string, unknown>>;
      [rows[0], rows[1]] = [rows[1]!, rows[0]!];
      rows[0]!.rank = 1; rows[1]!.rank = 2;
    })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => {
      const rows = draft.batting as Array<Record<string, unknown>>;
      (rows[0]!.primaryMetric as Record<string, unknown>).value = null;
    })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => { draft.authToken = "secret-token-fixture"; })).success).toBe(false);
    expect(npbHotPayloadSchema.safeParse(altered(valid, (draft) => {
      draft.readiness = { ...(draft.readiness as Record<string, unknown>), status: "not_ready" };
    })).success).toBe(false);
  });
});

let temporaryDirectory: string | null = null;
afterEach(async () => {
  if (!temporaryDirectory) return;
  for (const name of await readdir(temporaryDirectory)) await unlink(join(temporaryDirectory, name));
  await rmdir(temporaryDirectory);
  temporaryDirectory = null;
});
it("validates a staged file before atomic replacement and keeps the prior file on invalid input", async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "npb-hot-test-"));
  const path = join(temporaryDirectory, "hot.json");
  const valid = create(readyBatch());
  const bytes = await writeNpbHotPayloadAtomically(path, valid);
  const prior = await readFile(path, "utf8");
  expect(Buffer.byteLength(prior, "utf8")).toBe(bytes);
  expect(npbHotPayloadSchema.parse(JSON.parse(prior))).toEqual(valid);
  const replacement = { ...valid, generatedAt: "2026-09-25T04:00:00.000Z" };
  await writeNpbHotPayloadAtomically(path, replacement);
  const current = await readFile(path, "utf8");
  expect(JSON.parse(current).generatedAt).toBe(replacement.generatedAt);
  await expect(writeNpbHotPayloadAtomically(path, { ...valid, schemaVersion: 2 } as never)).rejects.toThrow();
  expect(await readFile(path, "utf8")).toBe(current);
  expect(await readdir(temporaryDirectory)).toEqual(["hot.json"]);
});
