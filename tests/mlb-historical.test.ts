import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { historicalId, importHistoricalSeason, validateHistoricalGame, verifyHistoricalIdentityBridge } from "../src/data/mlb-historical";
import { battingAggregate, dateWindow, pitchingAggregate } from "../src/domain/mlb-historical-aggregate";
import { directBvpGamePoc } from "../src/data/mlb-retrosheet-bvp";
import { mlbBattingQualification, mlbPitchingQualification } from "../src/domain/mlb-ranking-qualification";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { MlbDataSources, MlbHistoricalSchedule } from "../src/ui/mlb-historical";
import { RETROSHEET_ATTRIBUTION } from "../src/data/source-registry";

const csv = (header: string, rows: string[]) => `${header}\n${rows.join("\n")}\n`;
const sourceGame = "HOM202509201";
it("blocks changed or missing Chadwick identity before any corrected Game write", () => {
  const bridge = new Map([["retro1", "uuid1"]]);
  const existing = new Map([["retrosheet:retro1", historicalId("player", "chadwick:uuid1")]]);
  expect(() => verifyHistoricalIdentityBridge(bridge, existing)).not.toThrow();
  expect(() => verifyHistoricalIdentityBridge(new Map([["retro1", "uuid2"]]), existing)).toThrow("identity review");
  expect(() => verifyHistoricalIdentityBridge(new Map(), existing)).toThrow("identity review");
});
function fixture() {
  const files = {
    "2025gameinfo.csv": csv("gid,visteam,hometeam,date,season,gametype,hruns,vruns,innings,number,wp,lp,save", [
      `${sourceGame},AWY,HOM,20250920,2025,regular,1,0,9,1,pit1,pit2,`,
    ]),
    "2025allplayers.csv": csv("id,first,last,bat,throw,g_p,g_c,g_1b", [
      "bat1,Alice,Batter,R,R,0,0,1", "bat2,Amy,Runner,R,R,0,0,0",
      "bat3,Bob,Batter,L,L,0,1,0", "pit1,Home,Pitcher,R,R,1,0,0",
      "pit2,Away,Pitcher,R,R,1,0,0", "pit3,Zero,Outs,R,R,1,0,0",
    ]),
    "2025batting.csv": csv("gid,id,team,b_lp,b_seq,b_pa,b_ab,b_r,b_h,b_d,b_t,b_hr,b_rbi,b_sh,b_sf,b_hbp,b_w,b_k,b_sb,b_cs", [
      `${sourceGame},bat1,HOM,1,1,1,1,1,1,0,0,1,1,0,0,0,0,0,0,0`,
      `${sourceGame},bat2,HOM,1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0`,
      `${sourceGame},bat3,AWY,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0`,
    ]),
    "2025pitching.csv": csv("gid,id,team,p_seq,p_gs,p_ipouts,p_bfp,p_h,p_hr,p_w,p_hbp,p_k,p_r,p_er,wp,lp,save", [
      `${sourceGame},pit1,HOM,1,1,27,1,0,0,0,0,1,0,0,1,,`,
      `${sourceGame},pit3,HOM,2,,0,0,0,0,0,0,0,0,0,,,`,
      `${sourceGame},pit2,AWY,1,1,24,1,1,1,0,0,0,1,1,,1,`,
    ]),
    "2025teamstats.csv": csv("gid,team,b_pa,b_h,p_ipouts,p_bfp", [
      `${sourceGame},HOM,1,1,27,1`, `${sourceGame},AWY,1,0,24,1`,
    ]),
    "2025plays.csv": csv("gid,gametype,inning,outs_pre,score_v,score_h,pa,batter,pitcher,ab,single,double,triple,hr,walk,hbp,k", [
      `${sourceGame},regular,1,0,0,0,1,bat3,pit1,1,0,0,0,0,0,0,1`,
      `${sourceGame},regular,1,0,0,0,1,bat1,pit2,1,0,0,0,1,0,0,0`,
    ]),
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([key, value]) => [key, strToU8(value)])));
}
const bridge = new Map(["bat1", "bat2", "bat3", "pit1", "pit2", "pit3"]
  .map((id, index) => [id, `0000000${index}-0000-4000-8000-000000000000`]));

describe("Retrosheet Historical normalization", () => {
  it("shows required source credit and identity-only attribution", () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MlbDataSources)));
    expect(html).toContain(RETROSHEET_ATTRIBUTION.replaceAll('"', '&quot;'));
    expect(html).toContain("ODC Attribution License 1.0");
  });
  it("does not fall back from Current 2026 to a Historical result", () => {
    const manifest = { schemaVersion: 1 as const, league: "MLB" as const, current2026: "unavailable" as const,
      teams: [], seasons: [{ season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", games: 2430, coverage: "complete", playerCount: 1000 }] };
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/MLB/schedule?season=2026"] },
      createElement(MlbHistoricalSchedule, { manifest })));
    expect(html).toContain("2026年の試合結果・選手成績は未対応");
    expect(html).not.toContain("2025-09-28");
  });
  it("rejects malformed or cross-league static data before rendering", () => {
    const manifest = { schemaVersion: 1, league: "MLB", current2026: "unavailable",
      seasons: [{ season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", games: 2430, coverage: "complete", playerCount: 1000 }],
      teams: [{ id: historicalId("team", "test"), name: "Test team" }] };
    expect(validStaticPayload("manifest.json", manifest)).toBe(true);
    expect(validStaticPayload("manifest.json", { schemaVersion: 1, league: "NPB", current2026: "unavailable", seasons: [], teams: [] })).toBe(false);
    expect(validStaticPayload("games/example.json", { schemaVersion: 1, league: "MLB", game: { id: sourceGame, batting: [], pitching: [] } })).toBe(false);
    const game = importHistoricalSeason(fixture(), 2025, bridge).games[0]!;
    expect(validStaticPayload("games/example.json", { schemaVersion: 1, league: "MLB", game: { ...game,
      batting: game.batting.map(row => ({ ...row, name: "Batter" })),
      pitching: game.pitching.map(row => ({ ...row, name: "Pitcher" })) } })).toBe(true);
  });
  it("preserves canonical identity, doubleheader, same-slot substitutions, zero PA and zero outs", () => {
    const result = importHistoricalSeason(fixture(), 2025, bridge);
    expect(result.validationIssueCount).toBe(0);
    expect(result.unresolvedRetrosheetIds).toEqual([]);
    const game = result.games[0]!;
    expect(game.id).toMatch(/^mlb:game:[0-9a-f]{8}-/);
    expect(game.id).not.toContain(sourceGame);
    expect(game.number).toBe(1);
    expect(game.batting.map(row => [row.battingOrder, row.appearanceOrder, row.pa, row.starter]))
      .toEqual([[1, 1, 1, true], [1, 2, 0, false], [1, 1, 1, true]]);
    expect(game.pitching.map(row => [row.role, row.outsRecorded]))
      .toEqual([["starter", 27], ["reliever", 0], ["starter", 24]]);
  });
  it("keeps missing Chadwick bridge explicit without a name merge", () => {
    const result = importHistoricalSeason(fixture(), 2025, new Map());
    expect(result.unresolvedRetrosheetIds).toHaveLength(6);
    expect(new Set(result.players.map(player => player.id)).size).toBe(6);
  });
  it("rejects invalid team totals rather than declaring coverage complete", () => {
    const game = importHistoricalSeason(fixture(), 2025, bridge).games[0]!;
    expect(validateHistoricalGame(game, [{ team: "HOM", b_pa: "2", b_h: "1", p_ipouts: "27", p_bfp: "1" },
      { team: "AWY", b_pa: "1", b_h: "0", p_ipouts: "24", p_bfp: "1" }]))
      .toContain("HOM:b_pa");
  });
  it("reuses period aggregators for season and recent metrics", () => {
    const game = importHistoricalSeason(fixture(), 2025, bridge).games[0]!;
    const batter = game.batting[0]!;
    const sample = { ...batter, gameId: game.id, date: game.date, season: 2025,
      home: true, opponentTeamId: game.awayTeamId };
    const aggregate = battingAggregate(batter.playerId, [sample], game.date, game.date);
    expect(aggregate.metrics.OPS.value).toBe(5);
    expect(aggregate.metrics.PA.value).toBe(1);
    const pitcher = game.pitching[0]!;
    const pitching = pitchingAggregate(pitcher.playerId, [{ ...pitcher, gameId: game.id,
      date: game.date, season: 2025, home: true, opponentTeamId: game.awayTeamId }], game.date, game.date);
    expect(pitching.metrics.outsRecorded.value).toBe(27);
    expect(pitching.metrics.ERA.value).toBe(0);
    expect(dateWindow("2025-09-20", 7)).toEqual({ from: "2025-09-14", to: "2025-09-20" });
  });
  it("uses explicit PBP batter/pitcher pairs for direct BvP", async () => {
    const result = await directBvpGamePoc(fixture(), 2025, sourceGame);
    expect(result.missingRelation).toBe(0);
    expect(result.mismatches).toEqual([]);
    expect(result.pairs).toHaveLength(2);
    expect(result.pairs.find(row => row.batterRetrosheetId === "bat1" && row.pitcherRetrosheetId === "pit2"))
      .toMatchObject({ pa: 1, ab: 1, homeRuns: 1, hits: 1 });
  });
  it("keeps distinct entity namespaces", () => {
    expect(historicalId("player", "a")).not.toBe(historicalId("game", "a"));
    expect(historicalId("player", "a")).toBe(historicalId("player", "a"));
  });
  it("uses scheduled-season qualification denominators and preserves unknown", () => {
    expect(mlbBattingQualification(2020, 186)).toBe("qualified");
    expect(mlbBattingQualification(2025, 501)).toBe("unqualified");
    expect(mlbBattingQualification(2025, 502)).toBe("qualified");
    expect(mlbPitchingQualification(2020, 180)).toBe("qualified");
    expect(mlbPitchingQualification(2025, 485)).toBe("unqualified");
    expect(mlbPitchingQualification(2025, 486)).toBe("qualified");
    expect(mlbBattingQualification(2026, 900)).toBe("unknown");
    expect(mlbPitchingQualification(2025, null)).toBe("unknown");
  });
});

