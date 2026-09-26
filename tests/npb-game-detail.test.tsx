import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateData, openDataClient, type DataClient } from "../src/data/database";
import { NpbGameDetailRepository } from "../src/data/npb-game-detail-repository";
import { NpbRepository } from "../src/data/npb-repository";
import { HttpNpbGameDetailRepository } from "../src/infrastructure/providers/http-npb-game-detail-repository";
import { NpbGameDetailView } from "../src/ui/npb-game-detail";
import { PlayerGameLogView } from "../src/ui/player-game-log";
import { playerGameLogResponseSchema } from "../src/domain/player-game-log";

const gameId = "npb:game:32c76ee9e92f7408892c";
const players = ["06a3e027-7a73-4792-9c91-8ecc3c1da36a", "2d760a27-b58a-47a5-80df-6b0aa3571ef5",
  "6bf4b271-e16c-43f9-9142-8c7ca7de9887", "18f28f0f-a0b1-4970-aa9a-cce98530eac8"];
const clients: DataClient[] = [];
afterEach(() => { for (const client of clients.splice(0)) client.close(); });

async function fixture(status: "final" | "scheduled" | "postponed" = "final") {
  const client = openDataClient("file::memory:"); clients.push(client);
  await migrateData(client);
  await new NpbRepository(client).syncTeamMappings("2026-09-25T00:00:00Z");
  for (const [index, id] of players.entries()) await client.execute({ sql: `INSERT INTO master_history
    (entity_kind,entity_id,valid_from,payload_json,source_key,source_record_id,collected_at)
    VALUES ('player',?,'2026-09-01',?,'test',?,'2026-09-25T00:00:00Z')`,
    args: [id, JSON.stringify({ name: ["打者甲", "坂本誠志郎", "投手甲", "投手乙"][index]! }), id] });
  await client.execute({ sql: `INSERT INTO npb_games
    (game_id,season,game_date,home_team_id,away_team_id,game_number,status,home_score,away_score,
    source_key,source_record_id,source_url,collected_at,content_hash)
    VALUES (?,2026,'2026-09-25','npb:team:tigers','npb:team:baystars',1,?,1,2,
    'test','g','https://example.test/','2026-09-25T00:00:00Z','hash')`, args: [gameId, status] });
  if (status !== "final") return client;
  for (const [id, playerId, pa, ab, hits, walks, starter] of [
    ["b1", players[0], 0, 0, 0, 0, 1], ["b2", players[1], 3, 2, 0, 1, 0],
  ] as const) await client.execute({ sql: `INSERT INTO player_game_batting
    (game_id,player_id,team_id,opponent_team_id,batting_order,pa,ab,hits,doubles,triples,home_runs,
    rbi,walks,strikeouts,hbp,sb,cs,source_key,source_record_id,collected_at,runs,starter,sacrifice_hits,sacrifice_flies)
    VALUES (?,?,'npb:team:tigers','npb:team:baystars',8,?,?,?,0,0,0,0,?,0,0,0,0,'test',?,
    '2026-09-25T00:00:00Z',0,?,0,0)`, args: [gameId,playerId!,pa,ab,hits,walks,id,starter] });
  for (const [id, playerId, role, order, outs, bf, decision] of [
    ["p1",players[2],"starter",1,17,22,"loss"], ["p2",players[3],"reliever",2,0,2,"hold"],
  ] as const) await client.execute({ sql: `INSERT INTO player_game_pitching
    (fact_id,game_id,player_id,team_id,opponent_team_id,role,appearance_order,ip_outs,
    batters_faced,hits,home_runs,walks,strikeouts,runs,earned_runs,pitches,catcher_id,
    source_key,source_record_id,collected_at,starter,decision,walks_and_hit_batters)
    VALUES (?,?,?,'npb:team:tigers','npb:team:baystars',?,?,?, ?,2,0,NULL,1,1,1,27,NULL,
    'test',?,'2026-09-25T00:00:00Z',?, ?,2)`,
    args: [id,gameId,playerId!,role,order,outs,bf,id,role === "starter" ? 1 : 0,decision] });
  await new NpbRepository(client).saveGameCompleteness({ gameId, battingStatus: "complete", pitchingStatus: "complete",
    gameStatus: "complete", expectedBatters: 2, collectedBatters: 2, mappedBatters: 2,
    expectedPitchers: 2, collectedPitchers: 2, mappedPitchers: 2, checks: {}, issues: [],
    sourceKey: "test", verifiedAt: "2026-09-25T00:00:00Z" });
  return client;
}

describe("NPB Game Detail", () => {
  it("uses six fixed SELECTs and projects canonical names, teams, duplicate batting slots and nullable stats", async () => {
    const client = await fixture();
    const execute = vi.fn((statement: Parameters<DataClient["execute"]>[0]) => client.execute(statement));
    const result = await new NpbGameDetailRepository({ execute } as unknown as DataClient).find(gameId);
    expect(execute).toHaveBeenCalledTimes(6);
    expect(result?.payload).toMatchObject({ gameId, date: "2026-09-25", status: "final", completeness: "complete",
      home: { score: 1, totals: { pa: 3, paSource: "battingFacts", ab: 2, hits: 0 } },
      away: { score: 2, totals: { pa: 24, paSource: "opponentBf" } } });
    expect(result?.payload.batting.home).toHaveLength(2);
    expect(result?.payload.batting.home.map((row) => row.battingOrder)).toEqual([8,8]);
    expect(result?.payload.batting.home.find((row) => row.name === "坂本誠志郎"))
      .toMatchObject({ pa: 3, ab: 2, walks: 1, starter: false });
    expect(result?.payload.pitching.home.map((row) => [row.role,row.outsRecorded,row.decision]))
      .toEqual([["starter",17,"loss"],["reliever",0,"hold"]]);
    expect(result?.payload.pitching.home[1]?.walksAndHitByPitch).toBe(2);
    expect(JSON.stringify(result)).not.toMatch(/sourceUrl|sourceRecordId|WHIP|authToken/);
  });

  it("handles scheduled, postponed, missing and partial without invented Box Score", async () => {
    for (const status of ["scheduled", "postponed"] as const) {
      const result = (await new NpbGameDetailRepository(await fixture(status)).find(gameId))!.payload;
      expect(result.batting.home).toHaveLength(0);
      expect(result.home.totals.pa).toBeNull();
      const html = renderToStaticMarkup(<NpbGameDetailView payload={result} state="ready" />);
      expect(html).toContain(status === "scheduled" ? "開始前" : "延期");
      expect(html).not.toContain("ボックススコア");
    }
    const client = await fixture();
    const repository = new NpbGameDetailRepository(client);
    expect(await repository.find("npb:game:00000000000000000000")).toBeNull();
    await client.execute({ sql: "UPDATE npb_game_completeness SET game_status='partial' WHERE game_id=?", args: [gameId] });
    const partial = (await repository.find(gameId))!.payload;
    expect(partial.away.totals).toMatchObject({ pa: null, paSource: "unavailable" });
    expect(renderToStaticMarkup(<NpbGameDetailView payload={partial} state="ready" />)).toContain("一部の成績を取得できていません");
    expect(renderToStaticMarkup(<NpbGameDetailView payload={null} state="missing" />)).toContain("試合が見つかりません");
    expect(renderToStaticMarkup(<NpbGameDetailView payload={null} state="error" />)).toContain("取得できませんでした");
    expect(renderToStaticMarkup(<NpbGameDetailView payload={null} state="loading" />)).toContain("skeleton");
  });

  it("renders both teams, nullable 0 PA, outs, decisions and player navigation without WHIP", async () => {
    const payload = (await new NpbGameDetailRepository(await fixture()).find(gameId))!.payload;
    const html = renderToStaticMarkup(<NpbGameDetailView payload={payload} state="ready" />);
    expect(html).toContain("ビジター · DeNA");
    expect(html).toContain("ホーム · 阪神");
    expect(html).toContain("打席なし");
    expect(html).toContain("5.2回");
    expect(html).toContain("0.0回");
    expect(html).toContain("四死");
    expect(html).toContain(`#/NPB/players/${players[1]}`);
    expect(html).toContain("詳しい打撃成績");
    expect(html).not.toContain("WHIP");
  });

  it("reflects a corrected Fact on the next read and rejects invalid/mismatched HTTP payload", async () => {
    const client = await fixture();
    const repository = new NpbGameDetailRepository(client);
    const before = (await repository.find(gameId))!.payload;
    await client.execute({ sql: "UPDATE player_game_batting SET hits=1 WHERE source_record_id='b2'" });
    const after = (await repository.find(gameId))!.payload;
    expect(before.home.totals.hits).toBe(0);
    expect(after.home.totals.hits).toBe(1);
    const http = new HttpNpbGameDetailRepository("https://example.test/", async () =>
      new Response(JSON.stringify(after), { status: 200 }));
    expect((await http.find(gameId))?.home.totals.hits).toBe(1);
    await expect(new HttpNpbGameDetailRepository("https://example.test/", async () =>
      new Response("{}", { status: 200 })).find(gameId)).rejects.toThrow();
    expect(await new HttpNpbGameDetailRepository("https://example.test/", async () =>
      new Response("{}", { status: 404 })).find(gameId)).toBeNull();
  });

  it("links Game Log to the canonical Game route", () => {
    const row = { gameId, date: "2026-09-25", gameNumber: 1, status: "final", teamId: "npb:team:tigers",
      opponentTeamId: "npb:team:baystars", side: "home", homeTeamId: "npb:team:tigers",
      awayTeamId: "npb:team:baystars", homeScore: 1, awayScore: 2, result: "loss",
      battingOrder: 8, starter: false, pa: 3, ab: 2, runs: 0, hits: 0, doubles: 0, triples: 0,
      homeRuns: 0, rbi: 0, walks: 1, hbp: 0, sacrificeHits: 0, sacrificeFlies: 0,
      strikeouts: 0, stolenBases: 0, caughtStealing: 0 };
    const payload = playerGameLogResponseSchema.parse({ playerId: players[1], limit: 10, offset: 0,
      batting: [row], pitching: [] });
    const html = renderToStaticMarkup(<PlayerGameLogView payload={payload} state="ready"
      teams={new Map([["npb:team:baystars","DeNA"]])} />);
    expect(html).toContain(`#/NPB/games/${encodeURIComponent(gameId)}`);
    expect(html).toContain("対DeNA");
  });
});
