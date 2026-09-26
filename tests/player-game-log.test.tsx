import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { openDataClient, migrateData } from "../src/data/database";
import { NpbPlayerGameLogRepository } from "../src/data/npb-player-game-log-repository";
import { formatOuts, gameContext, type PlayerGameLogResponse } from "../src/domain/player-game-log";
import { PlayerGameLogView } from "../src/ui/player-game-log";
import { HttpPlayerGameLogRepository } from "../src/infrastructure/providers/http-player-game-log-repository";
import type { DataClient } from "../src/data/database";

const playerId = "06a3e027-7a73-4792-9c91-8ecc3c1da36a";
const noFactId = "a66dfd52-1ae2-4245-b849-558f263e6422";
const teams = new Map([["home", "阪神"], ["away", "DeNA"]]);
const clients: DataClient[] = [];
afterEach(() => { for (const client of clients.splice(0)) client.close(); });

async function fixture() {
  const client = openDataClient("file::memory:");
  clients.push(client);
  await migrateData(client);
  for (const id of [playerId, noFactId]) await client.execute({ sql: `INSERT INTO master_history
    (entity_kind,entity_id,valid_from,payload_json,source_key,source_record_id,collected_at)
    VALUES ('player',?,'2026-09-01','{}','test',?,'2026-09-25T00:00:00Z')`, args: [id,id] });
  for (const [id, date, number, homeScore, awayScore] of [
    ["game-1", "2026-09-25", 1, 3, 2], ["game-2", "2026-09-25", 2, 1, 1],
    ["game-0", "2026-09-24", 1, 0, 2], ["game-3", "2026-09-23", 1, 1, 4],
    ["game-4", "2026-09-22", 1, 3, 2],
  ] as const) await client.execute({ sql: `INSERT INTO npb_games
    (game_id,season,game_date,home_team_id,away_team_id,game_number,status,home_score,away_score,
    source_key,source_record_id,source_url,collected_at,content_hash)
    VALUES (?,2026,?,'home','away',?,'final',?,?,'test',?,'https://example.test/',
    '2026-09-25T00:00:00Z','hash')`, args: [id,date,number,homeScore,awayScore,id] });
  await client.execute({ sql: `INSERT INTO player_game_batting
    (game_id,player_id,team_id,opponent_team_id,batting_order,pa,ab,hits,doubles,triples,home_runs,
    rbi,walks,strikeouts,hbp,sb,cs,source_key,source_record_id,collected_at,runs,starter,sacrifice_hits,sacrifice_flies)
    VALUES ('game-1',?,'home','away',5,7,3,2,1,1,0,1,1,0,1,NULL,NULL,'test','b1',
    '2026-09-25T00:00:00Z',1,1,1,1)`, args: [playerId] });
  await client.execute({ sql: `INSERT INTO player_game_batting
    (game_id,player_id,team_id,opponent_team_id,batting_order,pa,ab,hits,home_runs,
    source_key,source_record_id,collected_at,starter)
    VALUES ('game-2',?,'away','home',5,0,0,0,0,'test','b2','2026-09-25T00:00:00Z',0)`, args: [playerId] });
  await client.execute({ sql: `INSERT INTO player_game_batting
    (game_id,player_id,team_id,opponent_team_id,batting_order,pa,ab,hits,home_runs,
    source_key,source_record_id,collected_at,starter)
    VALUES ('game-0',?,'home','away',3,4,4,1,1,'test','b0','2026-09-24T00:00:00Z',1)`, args: [playerId] });
  await client.execute({ sql: `INSERT INTO player_game_pitching
    (fact_id,game_id,player_id,team_id,opponent_team_id,role,appearance_order,ip_outs,
    batters_faced,hits,home_runs,walks,strikeouts,runs,earned_runs,pitches,catcher_id,
    source_key,source_record_id,collected_at,starter,decision,walks_and_hit_batters)
    VALUES ('pitch-1','game-1',?,'home','away','reliever',NULL,17,22,4,0,NULL,7,1,1,87,NULL,
    'test','p1','2026-09-25T00:00:00Z',0,'hold',2)`, args: [playerId] });
  for (const [id, gameId, role, outs, decision] of [
    ["pitch-0", "game-0", "starter", 18, "win"],
    ["pitch-3", "game-3", "starter", 0, "loss"],
    ["pitch-4", "game-4", "reliever", 2, "save"],
  ] as const) await client.execute({ sql: `INSERT INTO player_game_pitching
    (fact_id,game_id,player_id,team_id,opponent_team_id,role,appearance_order,ip_outs,
    source_key,source_record_id,collected_at,starter,decision)
    VALUES (?,?,?,'home','away',?,NULL,?,'test',?,'2026-09-25T00:00:00Z',?,?)`,
    args: [id,gameId,playerId,role,outs,id,role === "starter" ? 1 : 0,decision] });
  return client;
}

describe("Player Game Log", () => {
  it("joins Game metadata in three SELECTs, preserves doubleheaders, null and 0 PA, and respects limit", async () => {
    const client = await fixture();
    const execute = vi.fn((statement: Parameters<DataClient["execute"]>[0]) => client.execute(statement));
    const repository = new NpbPlayerGameLogRepository({ execute } as unknown as DataClient);
    const result = await repository.find(playerId);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(result?.batting.map((row) => row.gameId)).toEqual(["game-2", "game-1", "game-0"]);
    expect(result?.batting[0]).toMatchObject({ date: "2026-09-25", gameNumber: 2,
      side: "away", result: "tie", pa: 0, ab: 0, starter: false, doubles: null });
    expect(result?.batting[1]).toMatchObject({ side: "home", opponentTeamId: "away",
      result: "win", pa: 7, doubles: 1, triples: 1, walks: 1,
      hbp: 1, sacrificeHits: 1, sacrificeFlies: 1 });
    expect(result?.batting[2]?.homeRuns).toBe(1);
    expect(result?.pitching[0]).toMatchObject({ role: "reliever", outsRecorded: 17,
      battersFaced: 22, walksAndHitByPitch: 2, decision: "hold", pitchCount: 87 });
    expect(result?.pitching.map((row) => row.decision)).toEqual(["hold", "win", "loss", "save"]);
    expect(result?.pitching.map((row) => row.outsRecorded)).toEqual([17, 18, 0, 2]);
    expect((await repository.find(playerId, 1))?.batting).toHaveLength(1);
    expect((await repository.find(playerId, 1, 1))?.batting[0]?.gameId).toBe("game-1");
    expect(await repository.find(noFactId)).toMatchObject({ batting: [], pitching: [] });
  });

  it("reflects a corrected Fact on the next read without derived writes", async () => {
    const client = await fixture();
    const repository = new NpbPlayerGameLogRepository(client);
    const before = await repository.find(playerId);
    await client.execute("UPDATE player_game_batting SET hits=1 WHERE source_record_id='b1'");
    const after = await repository.find(playerId);
    expect(before?.batting[1]?.hits).toBe(2);
    expect(after?.batting[1]?.hits).toBe(1);
    expect((await client.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n).toBe(3);
  });

  it("refuses mismatched opponent/team instead of inventing Game context", () => {
    const game = { gameId: "game", date: "2026-09-25", gameNumber: 1, status: "final",
      homeTeamId: "home", awayTeamId: "away", homeScore: 3, awayScore: 2 };
    expect(() => gameContext(game, "other", null)).toThrow("not in game");
    expect(() => gameContext(game, "home", "other")).toThrow("conflicts");
    expect(gameContext({ ...game, status: "scheduled" }, "home", "away").result).toBeNull();
  });

  it("formats outs as baseball innings, including zero, one and two outs", () => {
    expect([0, 1, 2, 17].map(formatOuts)).toEqual(["0.0", "0.1", "0.2", "5.2"]);
  });

  it("renders compact/detail Batting and Pitching without WHIP or false zero", async () => {
    const payload = (await new NpbPlayerGameLogRepository(await fixture()).find(playerId))!;
    const html = renderToStaticMarkup(<PlayerGameLogView payload={payload} state="ready" teams={teams} />);
    expect(html).toContain("対DeNA");
    expect(html).toContain("対阪神");
    expect(html).toContain("3打数2安打");
    expect(html).toContain("途中出場 / 打席なし");
    expect(html).toContain("第2試合");
    expect(html).toContain("5.2回");
    expect(html).toContain("四死");
    expect(html).toContain("87");
    expect(html).toContain("1本塁打");
    expect(html).toContain("<dt>HBP</dt><dd>1</dd>");
    expect(html).toContain("<dt>SH</dt><dd>1</dd>");
    expect(html).toContain("<dt>SF</dt><dd>1</dd>");
    expect(html).toContain(" · S");
    expect(html).not.toContain("WHIP");
    expect(html).toContain("詳細成績");
    expect(html).toContain("<dd>—</dd>");
  });

  it("keeps loading, empty and error local to Game Log", async () => {
    const empty = (await new NpbPlayerGameLogRepository(await fixture()).find(noFactId))!;
    const view = (state: "loading" | "ready" | "error", payload: PlayerGameLogResponse | null = null) =>
      renderToStaticMarkup(<PlayerGameLogView payload={payload} state={state} teams={teams} />);
    expect(view("loading")).toContain("skeleton");
    expect(view("error")).toContain("試合別成績を読み込めません");
    expect(view("ready", empty)).toContain("保存済みの試合別成績はありません");
  });

  it("rejects invalid response and has no mock fallback", async () => {
    const payload = (await new NpbPlayerGameLogRepository(await fixture()).find(playerId))!;
    const valid = new HttpPlayerGameLogRepository("https://example.test/", async () =>
      new Response(JSON.stringify(payload), { status: 200 }));
    expect((await valid.find(playerId))?.batting).toHaveLength(3);
    const invalid = new HttpPlayerGameLogRepository("https://example.test/", async () => new Response("{}"));
    await expect(invalid.find(playerId)).rejects.toThrow();
  });
});
