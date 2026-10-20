import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { buildWikipediaNpbSeries, npbSeriesId } from "../src/infrastructure/providers/wikipedia-npb-series";
import { assertCsSeriesSnapshot } from "../src/domain/npb-postseason-series";
import { seriesFixture as fixture } from "./fixtures/npb-series";


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
