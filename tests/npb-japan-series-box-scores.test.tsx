import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import release from "../src/data/npb-japan-series-box-scores.json";
import identities from "../src/data/npb-japan-series-player-links.json";
import npbRegistry from "../src/data/npb-free-profile-identities.json";
import { reviewedProfileBridges } from "../src/data/npb-reviewed-profile-bridges";
import { admittedJapanSeriesScopes, japanSeriesBoxScore, japanSeriesPlayerGames, japanSeriesPlayerId, type JapanSeriesBoxScore } from "../src/data/npb-japan-series-box-scores";
import { JapanSeriesBoxScoreTables, JapanSeriesPlayerBoxScores } from "../src/ui/japan-series-box-score";
import { japanCompletedFixture } from "./fixtures/npb-japan-completed";

function renderBox(box: JapanSeriesBoxScore) {
  return renderToStaticMarkup(<MemoryRouter><JapanSeriesBoxScoreTables box={box} /></MemoryRouter>);
}

describe("2026 Japan Series box score admission", () => {
  it("keeps team sides, observed pitching outs, and the two withheld fields", () => {
    const licensedRows = release.boxes.flatMap<JapanSeriesBoxScore["teams"][number]>(game => game.teams);
    expect(licensedRows.reduce((sum, team) => sum + team.batting.length, 0)).toBe(117);
    expect(licensedRows.reduce((sum, team) => sum + team.pitching.length, 0)).toBe(44);
    expect(licensedRows.map(team => team.pitching.reduce((sum, row) => sum + row.outs, 0)))
      .toEqual([33, 33, 30, 30, 28, 30, 24, 27]);
    expect(licensedRows.map(team => team.batting.reduce((sum, row) => sum + row.homeRuns, 0)))
      .toEqual([0, 1, 3, 1, 0, 1, 1, 0]);
    expect(licensedRows.flatMap(team => team.batting.filter(row => row.atBats === null).map(row => row.name)))
      .toEqual(["山本祐大"]);
    expect(licensedRows.flatMap(team => team.pitching.filter(row => row.strikeouts === null).map(row => row.name)))
      .toEqual(["ショーン・レイノルズ"]);
    for (const team of licensedRows) {
      expect(new Set(team.batting.map(row => row.name)).size).toBe(team.batting.length);
      expect(new Set(team.pitching.map(row => row.name)).size).toBe(team.pitching.length);
      expect(team.batting.every(row => row.homeRuns <= row.hits && (row.atBats === null || row.hits <= row.atBats))).toBe(true);
    }
  });

  it("requires the reviewed result evidence, score, team order and final status", () => {
    const data = japanCompletedFixture().build();
    const first = release.boxes[0]!;
    const result = data.results.find(r => r.gameId === first.gameId)!;
    const game = data.series.games.find(g => g.gameId === first.gameId)!;
    expect(japanSeriesBoxScore(data, first.gameId)).toBeUndefined();
    result.evidenceSha256 = first.resultEvidenceSha256;
    expect(japanSeriesBoxScore(data, first.gameId)).toBeUndefined();
    game.awayRuns = first.awayRuns;
    game.homeRuns = first.homeRuns;
    expect(japanSeriesBoxScore(data, first.gameId)).toBe(first);
    const away = game.awayTeamId;
    game.awayTeamId = game.homeTeamId;
    expect(japanSeriesBoxScore(data, first.gameId)).toBeUndefined();
    game.awayTeamId = away;
    game.status = "cancelled";
    expect(japanSeriesBoxScore(data, first.gameId)).toBeUndefined();
    expect(japanSeriesBoxScore(data, "unknown")).toBeUndefined();
  });

  it("uses accessible team disclosures and displays a withheld value separately from zero", () => {
    const second = renderBox(release.boxes[1]!);
    expect(second).toContain("<summary>ソフトバンクの打撃</summary>");
    expect(second).toContain("<summary>DeNAの投球</summary>");
    expect(second).toContain("出典間で値が一致せず未収録");
    expect(second).toMatch(/山本祐大[\s\S]*?stat-table-content">—<\/span>/);
    expect(second).toContain('stat-table-content">0</span>');
    const third = renderBox(release.boxes[2]!);
    expect(third).toContain("勝利投手");
    expect(third).toMatch(/ショーン・レイノルズ[\s\S]*?stat-table-content">1\.0[\s\S]*?stat-table-content">—<\/span>/);
  });

  it("links the 55 independently verified players and preserves the unlinked performance rows", () => {
    expect(identities.boxSourceSha256).toBe(release.source.contentSha256);
    expect(admittedJapanSeriesScopes).toHaveLength(55);
    for (const identity of identities.players) {
      if (identity.bridgeSource === "reviewed_nf3") {
        expect(reviewedProfileBridges.find(row => row.playerId === identity.playerId)?.npbId).toBe(identity.npbId);
      } else {
        const registryRecord = npbRegistry.find(row => row.playerId === identity.playerId);
        expect(registryRecord?.npbId).toBe(identity.npbId);
        expect(registryRecord?.verificationStatus).toBe("source_verified");
        expect(registryRecord?.chadwick?.uuid).toBe(identity.chadwickId);
      }
    }
    const linked = release.boxes.map(game => game.teams.reduce((count, t) => count +
      t.batting.filter(row => japanSeriesPlayerId(t.teamId, "batting", row.name)).length +
      t.pitching.filter(row => japanSeriesPlayerId(t.teamId, "pitching", row.name)).length, 0));
    expect(linked).toEqual([46, 45, 32, 30]);
    expect(japanSeriesPlayerId("npb:team:hawks", "batting", "正木智也")).toBe("2b2a8d97-2a6e-441c-9a33-0d79d2a7d147");
    expect(japanSeriesPlayerId("npb:team:baystars", "batting", "正木智也")).toBeUndefined();
    expect(japanSeriesPlayerId("npb:team:baystars", "pitching", "ショーン・レイノルズ")).toBe("e88b4e3d-1c6c-4b81-9c7c-9af1e8e133f3");
    expect(japanSeriesPlayerId("npb:team:baystars", "pitching", "ホセ・ルイーズ")).toBeUndefined();
    expect(renderBox(release.boxes[1]!)).toContain("role=pitching&amp;boxSide=home&amp;competition=postseason&amp;stage=japan_series");
  });

  it("returns only reviewed game rows for the player's role and preserves series context on the way back", () => {
    const data = japanCompletedFixture().build();
    for (const box of release.boxes) {
      const result = data.results.find(r => r.gameId === box.gameId)!;
      const game = data.series.games.find(g => g.gameId === box.gameId)!;
      result.evidenceSha256 = box.resultEvidenceSha256;
      game.awayRuns = box.awayRuns;
      game.homeRuns = box.homeRuns;
    }
    const playerId = "2b2a8d97-2a6e-441c-9a33-0d79d2a7d147";
    const games = japanSeriesPlayerGames(data, playerId, "batting");
    expect(games.map(game => [game.box.gameNumber, game.side])).toEqual([[1, "away"], [2, "away"], [3, "home"], [4, "home"]]);
    expect(japanSeriesPlayerGames(data, playerId, "pitching")).toEqual([]);
    const table = renderToStaticMarkup(<MemoryRouter><JapanSeriesPlayerBoxScores games={games} playerId={playerId}
      role="batting" preferredGameId={release.boxes[3]!.gameId} /></MemoryRouter>);
    expect(table).toContain("boxSide=home&amp;competition=postseason&amp;stage=japan_series&amp;season=2026&amp;role=batting");
    expect(table).toMatch(/<a\b[^>]*aria-current="true"[^>]*>第4戦/);
    data.results[0]!.evidenceSha256 = "0".repeat(64);
    expect(japanSeriesPlayerGames(data, playerId, "batting")).toHaveLength(3);
  });
});
