import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { japanFixture } from "./fixtures/npb-japan-series";
import { buildWikipediaJapanSeries, japanGameId } from "../src/infrastructure/providers/wikipedia-npb-japan-series";

// Source-shaped synthetic records; never public results or source admission.
const split = ["bay", "hawk", "bay", "hawk", "bay", "hawk", null] as const;
function fixture(outcomes: readonly ("bay" | "hawk" | null)[], total: number) {
  const f = japanFixture(), pages = f.archive.response.query.pages;
  const days = ["10月24日", "10月25日", "10月27日", "10月28日", "10月29日", "10月31日", "11月1日", "11月2日", "11月4日"];
  const names = { bay: "横浜DeNAベイスターズ", hawk: "福岡ソフトバンクホークス" };
  const review = { reviewedBy: "synthetic source review", reviewedAt: "2026-11-05T00:01:00Z", games: [] as { gameId: string; linescore: string }[] };
  const rows: string[] = [];
  for (let i = 0; i < total; i++) {
    const home = i < 2 || i === 5 || i === 6 || i === 7 ? "bay" : "hawk", away = home === "bay" ? "hawk" : "bay";
    const final = i < outcomes.length, winner = outcomes[i], hr = winner === home ? 1 : 0, ar = winner === away ? 1 : 0;
    rows.push(`|-\n|${days[i]}（土）||第${i + 1}戦||${names[away]}|| ${final ? `${ar} - ${hr}` : "-"} ||${names[home]}||${home === "bay" ? "横浜スタジアム" : "みずほPayPayドーム福岡"}`);
    if (final) {
      const innings = winner === null ? 12 : 9;
      const cells = (prefix: string, runs: number) => Array.from({ length: innings }, (_, j) => `|${prefix}${j + 1}=${j === innings - 1 && prefix === "H" && hr > ar ? "X" : j === 0 ? runs : 0}`).join("");
      const block = `{{Linescore\n|Date=${days[i]}\n|Road=${names[away]}\n|Home=${names[home]}\n${cells("R", ar)}\n${cells("H", hr)}\n|RR=${ar}|HR=${hr}\n|WP=架空投手\n|Note2=試合時間：3時間12分\n}}`;
      pages[0]!.revisions[0]!.slots.main.content += `\n${block}`;
      review.games.push({ gameId: japanGameId(i + 1), linescore: block });
    }
  }
  pages[1]!.revisions[0]!.slots.main.content = `{|class="wikitable"\n${rows.join("\n")}\n|}`;
  f.archive.observedAt = "2026-11-05T00:00:00Z";
  const refresh = () => {
    for (const p of pages) f.admission.find(a => a.pageId === p.pageid)!.contentSha256 = createHash("sha256").update(p.revisions[0]!.slots.main.content).digest("hex");
  };
  refresh();
  return { f, review, refresh, build: () => buildWikipediaJapanSeries(f.archive, f.cs, "b".repeat(64), f.admission, review, Date.parse("2026-11-05T00:02:00Z")) };
}

it("imports an explicitly sourced eighth/ninth schedule only with the necessary prior finals and ties", () => {
  const eighth = fixture(split, 8).build();
  expect(eighth.results).toHaveLength(7);
  expect(eighth.series.games[7]).toMatchObject({ gameNumber: 8, status: "scheduled", awayRuns: null, homeRuns: null });
  const ninth = fixture(["bay", "hawk", "bay", "hawk", "bay", null, null, "hawk"], 9).build();
  expect(ninth.results).toHaveLength(8);
  expect(ninth.series.games[8]).toMatchObject({ gameNumber: 9, status: "scheduled", homeTeamId: "npb:team:hawks" });
});

it("rejects extra schedules with missing finals, no tie, or an already clinched series", () => {
  expect(() => fixture(split.slice(0, 6), 8).build()).toThrow();
  expect(() => fixture(["bay", "hawk", "bay", "hawk", "bay", "hawk", "bay"], 8).build()).toThrow();
  const f = fixture(split, 8);
  expect(() => buildWikipediaJapanSeries(f.f.archive, f.f.cs, "b".repeat(64), f.f.admission)).toThrow();
});

it("validates extra-game venue evidence at the actual source import boundary", () => {
  const f = fixture(split, 8), page = f.f.archive.response.query.pages[1]!;
  page.revisions[0]!.slots.main.content = page.revisions[0]!.slots.main.content.replace(/(第8戦[^\n]+)横浜スタジアム/, "$1みずほPayPayドーム福岡");
  f.refresh(); expect(() => f.build()).toThrow("venue");
});

it("rejects an unreviewed final, yet retains null scores for an elapsed date without a collected result", () => {
  const f = fixture(split, 8), scheduled = f.build().series.games[7]!;
  expect(scheduled).toMatchObject({ date: "2026-11-02", status: "scheduled", awayRuns: null, homeRuns: null });
  f.review.games.pop(); expect(() => f.build()).toThrow("reviewed completion");
});
