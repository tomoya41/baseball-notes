import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { buildWikipediaNpbSeries, npbSeriesId } from "../src/infrastructure/providers/wikipedia-npb-series";
import { assertCsSeriesSnapshot } from "../src/domain/npb-postseason-series";
import type { NpbCsDataset } from "../src/domain/npb-cs-observations";

// Synthetic infoboxes in the reviewed layouts; not a publishable dataset.
function fixture() {
  const observedAt = "2026-10-18T05:41:42.885Z", clubs = [
    [5301694, "パ", "福岡ソフトバンクホークス", "埼玉西武ライオンズ", "北海道日本ハムファイターズ", "hawks", "lions", "fighters"],
    [5302364, "セ", "阪神タイガース", "読売ジャイアンツ", "横浜DeNAベイスターズ", "tigers", "giants", "baystars"],
  ] as const;
  const games: NpbCsDataset["games"] = [];
  const pages = clubs.map(([pageid, league, first, second, third, leader, runner, challenger], p) => {
    const winner = p === 0 ? first : third;
    const content = `{{Infobox 日本プロ野球プレーオフ\n|開催年=2026\n|リーグ=${league}\n|優勝チーム=${winner}\n|CS1優勝=[[2026年の${third}|${third}]]\n|CS1対戦相手=${second}\n|CS1勝敗=2勝${p === 0 ? 1 : 0}敗\n|CSF優勝=${winner}\n|CSF対戦相手=${p === 0 ? third : first}\n|CSF勝敗=${p === 0 ? "5勝0敗（2勝のアドバンテージを含む）" : "4勝1敗（アドバンテージの1敗を含む）"}\n|1位=${first}\n|2位=${second}\n|3位=${third}\n|1位勝=${p === 0 ? 91 : 79}\n|1位負=${p === 0 ? 49 : 62}\n|3位勝=${p === 0 ? 78 : 71}\n|3位負=${p === 0 ? 62 : 69}\n}}`;
    for (const [stage, winners] of [["npb_cs_first", p === 0 ? [runner, challenger, challenger] : [challenger, challenger]], ["npb_cs_final", Array.from({length:p === 0 ? 3 : 4}, () => p === 0 ? leader : challenger)]] as const)
      winners.forEach((w, i) => { const home = stage === "npb_cs_first" ? runner : leader; games.push({ id: `npb:game:${String(games.length + 1).padStart(20, "0")}`, date: `2026-10-${String((stage === "npb_cs_first" ? 10 : 14) + i)}`, stage, homeTeamId: `npb:team:${home}`, awayTeamId: `npb:team:${challenger}`, homeScore: w === home ? 2 : 0, awayScore: w === home ? 0 : 2, homeHits: null, awayHits: null, sourcePageId: pageid, status: "final" }); });
    return { pageid, title: `2026年の${league === "パ" ? "パシフィック" : "セントラル"}・リーグクライマックスシリーズ`, revisions: [{ revid: pageid + 100, timestamp: "2026-10-18T04:00:00Z", slots: { main: { content } } }] };
  });
  const sources = pages.map(p => ({ pageId: p.pageid, title: p.title, revision: p.revisions[0]!.revid, revisionAt: p.revisions[0]!.timestamp, contentSha256: createHash("sha256").update(p.revisions[0]!.slots.main.content).digest("hex") }));
  const cs: NpbCsDataset = { schemaVersion: 1, league: "NPB", season: 2026, temporalScope: "saved_current", competition: "postseason", provider: "Wikipedia", license: "CC-BY-SA-4.0", coverage: "partial", granularity: "collected_game_aggregate", observedAt, inputSha256: "a".repeat(64), transformation: "Synthetic fixture", sources, players: [], games, rows: [] };
  return { archive: { observedAt, response: { query: { pages } } }, cs };
}
it("joins exact saved Games to explicit series outcomes, independent standings and 1/2-win rule evidence", () => {
  const { archive, cs } = fixture(), original = JSON.stringify(cs), data = buildWikipediaNpbSeries(archive, cs, "b".repeat(64));
  expect(data.series).toHaveLength(4); expect(data.coverage).toBe("partial");
  const finals = data.series.filter(s => s.round === "npb_cs_final");
  expect(finals.map(s => [s.bestOf, s.winsRequired, s.teams.map(t => t.advantageWins)])).toEqual([[7,5,[2,0]],[6,4,[0,1]]]);
  expect(data.series[0]!.advancesToSeriesId).toBe(finals[0]!.id);
  expect(JSON.stringify(cs)).toBe(original); expect(cs.rows).toEqual([]);
});
it("refuses missing/duplicate/ambiguous standings, incorrect outcomes, changed raw revisions and mismatched saved Games", () => {
  for (const change of ["standings", "duplicate", "summary", "raw", "game", "source", "unclosed", "unknown"] as const) {
    const {archive, cs} = fixture(), page = archive.response.query.pages[0]!, slot = page.revisions[0]!.slots.main;
    if (change === "standings") slot.content = slot.content.replace("|3位負=62", "|3位負=");
    if (change === "duplicate") slot.content = slot.content.replace("|1位勝=91", "|1位勝=91\n|1位勝=90");
    if (change === "summary") slot.content = slot.content.replace("5勝0敗", "4勝0敗");
    if (change === "raw") slot.content += "unreviewed";
    if (change === "game") cs.games[0]!.homeScore = 0;
    if (change === "source") page.revisions[0]!.revid++;
    if (change === "unclosed") slot.content = slot.content.slice(0,-2);
    if (change === "unknown") slot.content = slot.content.replace("|CS1優勝=", "|CS1優勝=不明");
    if (!["raw", "source"].includes(change)) cs.sources[0]!.contentSha256 = createHash("sha256").update(slot.content).digest("hex");
    expect(() => buildWikipediaNpbSeries(archive, cs, "b".repeat(64)), change).toThrow();
  }
});
it("keeps canonical series identity stable and fails a different Game snapshot", () => {
  expect(npbSeriesId(5301694,"npb_cs_final")).toBe(npbSeriesId(5301694,"npb_cs_final"));
  expect(npbSeriesId(5301694,"npb_cs_first")).not.toBe(npbSeriesId(5301694,"npb_cs_final"));
  const {archive,cs}=fixture(), data=buildWikipediaNpbSeries(archive,cs,"b".repeat(64));
  cs.games[0]!.homeScore++; expect(()=>assertCsSeriesSnapshot(data,cs)).toThrow();
});
