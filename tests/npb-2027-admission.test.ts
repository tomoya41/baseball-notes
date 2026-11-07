import { execFile } from "node:child_process";
import { mkdtemp, readdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it, vi } from "vitest";
import { buildNpbHotPayload } from "../src/application/npb-hot-payload";
import { PlayerPeriodBatchService } from "../src/application/player-period-batch";
import { migrateData, openDataClient, type DataClient } from "../src/data/database";
import type { NpbGame } from "../src/data/npb-nf3";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { NpbRepository } from "../src/data/npb-repository";
import { planNpbScheduleSync } from "../src/data/npb-season-lifecycle";
import { playerGameBattingSchema } from "../src/domain/game-facts";
import { recordsSchema } from "../src/domain/npb-records";

const date = "2027-03-26", collectedAt = "2027-03-27T00:00:00.000Z";
const window = { from: date, to: date, timeZone: "Asia/Tokyo" as const };

const calendarRequired = "Season metadata unavailable; reviewed calendar required";
it.each([
  ["collect-npb.ts", ["--date", date, "--fetch"], calendarRequired],
  ["collect-npb-day.ts", [`--date=${date}`, "--fetch"], calendarRequired],
  ["dry-run-npb-day.ts", [`--date=${date}`], calendarRequired],
  ["backfill-npb-season.ts", [`--from=${date}`, `--to=${date}`, "--mode=ingest"], "Invalid completed regular-season range"],
] as const)("%s rejects the unadmitted year before opening or creating a database", async (script, args, message) => {
  const cwd = await mkdtemp(join(tmpdir(), "npb-unadmitted-"));
  try {
    await expect(promisify(execFile)(process.execPath,
      ["--import", import.meta.resolve("tsx"), resolve("scripts", script), ...args],
      { cwd, env: { ...process.env, TURSO_DATABASE_URL: "file:must-not-create.db", TURSO_AUTH_TOKEN: "" }, timeout: 15000 },
    )).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining(message) });
    expect(await readdir(cwd)).toEqual([]);
  } finally {
    await rmdir(cwd);
  }
}, 20000);

it("scheduled calendar preflight makes no queries in the unadmitted year", async () => {
  const execute = vi.fn();
  await expect(planNpbScheduleSync({ execute } as unknown as DataClient, "daily", date)).rejects.toThrow("reviewed calendar required");
  expect(execute).not.toHaveBeenCalled();
});

it("partial schedules and reviewed fixture changes do not establish results or no-games coverage", async () => {
  const client = openDataClient("file::memory:");
  const fixture: NpbGame = { id: "npb:game:test-opening", season: 2027, date, homeTeamId: "npb:team:t",
    awayTeamId: "npb:team:g", gameNumber: 1, venue: null, scheduledTime: null, status: "scheduled",
    homeScore: null, awayScore: null, sourceKey: "nf3", sourceRecordId: "test-opening", sourceUrl: "https://example.com/", collectedAt };
  try {
    await migrateData(client);
    const repo = new NpbRepository(client), coverage = new NpbPeriodCoverageRepository(client);
    await repo.saveGames([fixture], date, false, false);
    expect(await repo.findGamesByDate(date)).toEqual([fixture]);
    expect(await coverage.findPeriodCoverage(window)).toMatchObject({ status: "unknown", noGameDates: [], finalGameDates: [] });
    const postponed = { ...fixture, status: "postponed" as const };
    const additional = { ...fixture, id: "npb:game:test-added", sourceRecordId: "test-added", gameNumber: 2, scheduledTime: "18:00" };
    await repo.saveGames([postponed, additional], date, false);
    const changed = { ...additional, scheduledTime: "18:30" };
    await repo.saveGames([postponed, changed], date, false);
    expect(await repo.findGamesByDate(date)).toEqual(expect.arrayContaining([postponed, changed]));
    expect(await coverage.findPeriodCoverage(window)).toMatchObject({ status: "unknown", noGameDates: [], finalGameDates: [] });
  } finally {
    client.close();
  }
});

it("the first Fact stays scoped to 2027; failed Coverage and missing production evidence suppress rankings", async () => {
  const fact = playerGameBattingSchema.parse({ gameId: "npb:game:test-opening", playerId: "test-player",
    teamId: "npb:team:t", opponentTeamId: "npb:team:g", battingOrder: 1, pa: 4, ab: 4, runs: 0, hits: 1,
    doubles: 0, triples: 0, homeRuns: 0, rbi: 0, walks: 0, hbp: 0, sacrificeHits: 0, sacrificeFlies: 0,
    strikeouts: 0, stolenBases: null, caughtStealing: null, starter: true,
    sourceKey: "nf3", sourceRecordId: "test-first-fact", collectedAt });
  const facts = { findPeriodPlayerIds: vi.fn(async () => ({ batters: [fact.playerId], pitchers: [] })),
    findBattingByPeriod: vi.fn(async () => [fact]), findPitchingByPeriod: vi.fn(async () => []) };
  const service = new PlayerPeriodBatchService(facts, { findPeriodCoverage: async () => { throw new Error("Unavailable"); } },
    () => new Date(collectedAt));
  const batch = await service.aggregate({ period: "7d", asOfDate: date });
  expect(facts.findBattingByPeriod).toHaveBeenCalledExactlyOnceWith("2027-03-20", date, null, undefined);
  expect(batch.summary.battingFacts).toBe(1);
  expect(batch.coverage).toMatchObject({ status: "unavailable", noGameDates: [] });
  const { payload } = buildNpbHotPayload(batch, { generatedAt: collectedAt, scheduledProductionEvidence: false, metadata: new Map() });
  expect(payload.readiness).toMatchObject({ status: "not_ready", reasons: expect.arrayContaining(["scheduled_production_evidence_pending"]) });
  expect([payload.batting, payload.starters, payload.relievers]).toEqual([[], [], []]);
  expect(recordsSchema.shape.season.safeParse(2027).success).toBe(false);
});
