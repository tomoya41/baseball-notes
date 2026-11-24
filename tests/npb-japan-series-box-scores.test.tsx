import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import release from "../src/data/npb-japan-series-box-scores.json";
import { japanSeriesBoxScore, type JapanSeriesBoxScore } from "../src/data/npb-japan-series-box-scores";
import { JapanSeriesBoxScoreTables } from "../src/ui/japan-series-box-score";
import { japanCompletedFixture } from "./fixtures/npb-japan-completed";

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
    const second = renderToStaticMarkup(<JapanSeriesBoxScoreTables box={release.boxes[1]!}/>);
    expect(second).toContain("<summary>ソフトバンクの打撃</summary>");
    expect(second).toContain("<summary>DeNAの投球</summary>");
    expect(second).toContain("出典間で値が一致せず未収録");
    expect(second).toMatch(/山本祐大[\s\S]*?stat-table-content">—<\/span>/);
    expect(second).toContain('stat-table-content">0</span>');
    const third = renderToStaticMarkup(<JapanSeriesBoxScoreTables box={release.boxes[2]!}/>);
    expect(third).toContain("勝利投手");
    expect(third).toMatch(/ショーン・レイノルズ[\s\S]*?stat-table-content">1\.0[\s\S]*?stat-table-content">—<\/span>/);
  });
});
