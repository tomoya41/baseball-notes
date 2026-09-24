import { afterEach, describe, expect, it } from "vitest";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { mlb2025Teams, normalizeRetrosheetGames } from "../src/data/retrosheet";
import { SqliteStandingsRepository } from "../src/data/standings-repository";
import { standingsPayload } from "../src/data/payload";
import { StaticStandingsRepository } from "../src/infrastructure/providers/static-standings-repository";
import { cleanupExpired } from "../src/data/retention";
import { plateAppearanceFactSchema, playerGameBattingSchema } from "../src/domain/game-facts";

const clients: DataClient[] = [];
async function database(): Promise<DataClient> {
  const client = openDataClient("file::memory:");
  clients.push(client);
  await migrateData(client);
  return client;
}
afterEach(() => { for (const client of clients.splice(0)) client.close(); });

function seasonCsv(corrected = false): string {
  const lines = ["gid,visteam,hometeam,date,suspend,gametype,vruns,hruns,season"];
  for (let index = 0; index < 2430; index++) {
    const away = mlb2025Teams[index % 30];
    const home = mlb2025Teams[(index + 1) % 30];
    if (!away || !home) throw new Error("Missing test team");
    lines.push(`TEST${String(index).padStart(6, "0")},${away.sourceId},${home.sourceId},20250519,${index === 1 ? "20250521" : ""},regular,${index === 0 && corrected ? 0 : 2},1,2025`);
  }
  return lines.join("\n");
}

describe("standings data foundation", () => {
  it("keeps unavailable game fields null and separates score differential from inning", () => {
    const source = { sourceKey: "retrosheet-csv", sourceRecordId: "one", collectedAt: "2026-09-24T00:00:00.000Z" };
    expect(playerGameBattingSchema.parse({ ...source, gameId: "g", playerId: "p", teamId: "t", opponentTeamId: null,
      battingOrder: null, pa: null, ab: 0, hits: 0, doubles: null, triples: null,
      homeRuns: null, rbi: null, walks: null, strikeouts: null, hbp: null,
      stolenBases: null, caughtStealing: null }).ab).toBe(0);
    expect(plateAppearanceFactSchema.parse({ ...source, id: "pa", gameId: "g", batterId: "b", pitcherId: null,
      battingOrder: 3, gameInning: 8, halfInning: "top", outsBefore: 1,
      baseState: 3, scoreDifferentialBefore: -2, resultCode: null, rbi: null }).scoreDifferentialBefore).toBe(-2);
  });
  it("normalizes source IDs, completion dates and rejects impossible input", () => {
    const games = normalizeRetrosheetGames(seasonCsv(), 2025, "2026-09-24T00:00:00.000Z");
    expect(games).toHaveLength(2430);
    expect(games[0]?.awayTeamId).toMatch(/^mlb:team:/);
    expect(games[1]?.completedOn).toBe("2025-05-21");
    expect(() => normalizeRetrosheetGames(seasonCsv().replace(",2,1,2025", ",-1,1,2025"), 2025, "2026-09-24T00:00:00.000Z")).toThrow();
    expect(() => normalizeRetrosheetGames(seasonCsv().split("\n").slice(0, 20).join("\n"), 2025, "2026-09-24T00:00:00.000Z")).toThrow(/Implausible/);
  });

  it("upserts idempotently, replays corrections and preserves historical dates", async () => {
    const client = await database();
    const repository = new SqliteStandingsRepository(client);
    const first = await repository.importRetrosheet2025(seasonCsv(), "2025-06-01");
    expect(first.inserted).toBe(2430);
    expect(await repository.findByDate("MLB", "2025-06-01")).toHaveLength(30);
    const before = (await repository.findByDate("MLB", "2025-06-01")).find((row) => row.teamId === mlb2025Teams[0]?.id);
    const repeat = await repository.importRetrosheet2025(seasonCsv(), "2025-06-02");
    expect(repeat).toMatchObject({ inserted: 0, updated: 0, skipped: 2430 });
    const corrected = await repository.importRetrosheet2025(seasonCsv(true), "2025-06-02");
    expect(corrected.updated).toBe(1);
    expect(corrected.snapshotDates).toEqual(["2025-06-01", "2025-06-02"]);
    const after = (await repository.findByDate("MLB", "2025-06-01")).find((row) => row.teamId === mlb2025Teams[0]?.id);
    expect(after?.wins).toBe((before?.wins ?? 0) - 1);
    const count = await client.execute("SELECT COUNT(*) AS n FROM game_facts");
    expect(Number(count.rows[0]?.n)).toBe(2430);
    const snapshotCount = await client.execute("SELECT COUNT(*) AS n FROM standings_daily");
    expect(Number(snapshotCount.rows[0]?.n)).toBe(60);
  });

  it("logs rejection without overwriting valid facts", async () => {
    const client = await database();
    const repository = new SqliteStandingsRepository(client);
    await repository.importRetrosheet2025(seasonCsv(), "2025-06-01");
    await expect(repository.importRetrosheet2025("bad,csv\n1,2", "2025-06-01")).rejects.toThrow();
    expect(await repository.findByDate("MLB", "2025-06-01")).toHaveLength(30);
    const runs = await client.execute("SELECT status, error_count FROM ingestion_runs ORDER BY started_at");
    expect(runs.rows.some((row) => row.status === "failed" && row.error_count === 1)).toBe(true);
  });

  it("exports a source-attributed payload through the app repository", async () => {
    const client = await database();
    const repository = new SqliteStandingsRepository(client);
    await repository.importRetrosheet2025(seasonCsv(), "2025-06-01");
    const payload = await standingsPayload(repository, "2025-06-01");
    const request = async () => new Response(JSON.stringify(payload), { status: 200 });
    const appRepository = new StaticStandingsRepository("/", request as typeof fetch);
    expect(await appRepository.findByDate("MLB", "2025-06-01")).toHaveLength(30);
    expect(payload.attribution).toContain("Retrosheet");
    const badRequest = async () => new Response(JSON.stringify({ ...payload, standings: [...payload.standings, payload.standings[0]] }), { status: 200 });
    await expect(new StaticStandingsRepository("/", badRequest as typeof fetch).findByDate("MLB", "2025-06-01")).rejects.toThrow();
  });

  it("expires only cache/derived/raw references, never facts or standings", async () => {
    const client = await database();
    const repository = new SqliteStandingsRepository(client);
    await repository.importRetrosheet2025(seasonCsv(), "2025-06-01");
    await client.execute("INSERT INTO display_cache VALUES ('x','{}','2025-01-01','2025-01-02')");
    await client.execute("INSERT INTO derived_payloads VALUES ('x','v1','r1','2025-01-01','{}','2025-01-01','2025-01-02')");
    const result = await cleanupExpired(client, ".data/raw", "2025-06-03T00:00:00.000Z");
    expect(result).toEqual({ cache: 1, derived: 1, raw: 0 });
    expect(await repository.findByDate("MLB", "2025-06-01")).toHaveLength(30);
    await client.execute("INSERT INTO raw_response_manifest VALUES ('../bad','retrosheet-csv','raw-response','2025-01-01','2025-01-02')");
    await expect(cleanupExpired(client, ".data/raw", "2025-06-03T00:00:00.000Z")).rejects.toThrow(/Unsafe/);
  });
});
