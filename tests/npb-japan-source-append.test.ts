import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildWikipediaJapanSeries } from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import { appendReviewedJapanFinals, assertJapanSeriesAdvance, japanResultSource, npbJapanSeriesSchema, type NpbJapanSeries } from "../src/domain/npb-japan-series";
import { japanResultFixture } from "./fixtures/npb-japan-series";
const initial = () => { const f = japanResultFixture("0", 0, 1); return buildWikipediaJapanSeries(f.archive, f.cs, "b".repeat(64), f.admission, f.review, f.now); };
function next(before: NpbJapanSeries) {
  const d = structuredClone(before), g = d.series.games[1]!;
  d.sources = d.sources.map(s => ({ ...s, revision: s.revision + 1, revisionAt: "2026-10-25T12:00:00Z", contentSha256: "f".repeat(64) }));
  d.observedAt = "2026-10-25T12:01:00Z"; d.review!.reviewedAt = "2026-10-25T12:02:00Z"; d.series.effectiveDate = "2026-10-25";
  g.status = "final"; g.awayRuns = 1; g.homeRuns = 0; g.winnerId = g.awayTeamId;
  d.results[0]!.evidenceSha256 = "e".repeat(64); // Changed non-statistical source formatting, not adopted facts.
  d.results.push({ gameId: g.gameId, awayInnings: [1, 0, 0, 0, 0, 0, 0, 0, 0], homeInnings: Array(9).fill(0), durationMinutes: 180, homeLastInning: "completed", sourcePageId: 5306035, evidenceSha256: "d".repeat(64) });
  for (const t of d.series.teams) { t.playedWins = d.series.games.filter(g => g.winnerId === t.teamId).length; t.seriesTotal = t.playedWins; }
  return npbJapanSeriesSchema.parse(d);
}
it("appends a separately reviewed final without rebasing old facts, hashes or source revisions", () => {
  const before = initial(), original = structuredClone(before), candidate = next(before), d = appendReviewedJapanFinals(before, candidate);
  expect(d.results).toHaveLength(2);
  expect(d.results[0]).toEqual(before.results[0]);
  expect(d.sources).toEqual(before.sources);
  expect(japanResultSource(d, d.results[0]!.gameId)).toEqual(before.sources[0]);
  expect(japanResultSource(d, d.results[1]!.gameId)).toEqual(candidate.sources[0]);
  expect(d.results[1]?.sourceRevision).toBe(candidate.sources[0]?.revision);
  expect(d.additionalSources).toHaveLength(2);
  expect(before).toEqual(original);
  expect(() => assertJapanSeriesAdvance(before, d)).not.toThrow();
  expect(() => assertJapanSeriesAdvance(before, candidate)).toThrow("source regression");
});
it("holds corrections, missing exact revisions, future result sources and conflicting same-revision hashes", () => {
  const before = initial(), corrected = next(before); corrected.results[0]!.durationMinutes++;
  expect(() => appendReviewedJapanFinals(before, corrected)).toThrow("correction");
  const d = appendReviewedJapanFinals(before, next(before)), missing = structuredClone(d);
  missing.additionalSources = []; expect(npbJapanSeriesSchema.safeParse(missing).success).toBe(false);
  const future = structuredClone(d); future.additionalSources![0]!.revisionAt = "2026-10-24T00:00:00Z";
  expect(npbJapanSeriesSchema.safeParse(future).success).toBe(false);
  const conflicting = next(before); conflicting.additionalSources = conflicting.sources;
  conflicting.sources = structuredClone(before.sources); conflicting.sources[0]!.contentSha256 = "a".repeat(64);
  expect(() => appendReviewedJapanFinals(before, conflicting)).toThrow("conflicting revision hash");
});
it("accepts schedule x only with matching reviewed home walk-off innings, never a score or X alone", () => {
  const f = japanResultFixture("1x", 0, 0), pages = f.archive.response.query.pages;
  const block = f.block.replace("|HR=0", "|HR=1");
  pages[0]!.revisions[0]!.slots.main.content = pages[0]!.revisions[0]!.slots.main.content.replace(f.block, block);
  pages[1]!.revisions[0]!.slots.main.content = pages[1]!.revisions[0]!.slots.main.content.replace("0 - 0", "0 - 1x");
  f.review.games[0]!.linescore = block;
  const hashes = () => { for (const p of pages) f.admission.find(a => a.pageId === p.pageid)!.contentSha256 = createHash("sha256").update(p.revisions[0]!.slots.main.content).digest("hex"); };
  const build = () => buildWikipediaJapanSeries(f.archive, f.cs, "b".repeat(64), f.admission, f.review, f.now);
  hashes(); expect(build().results[0]?.homeLastInning).toBe("walk_off");
  const invalid = block.replace("|H9=1x", "|H9=1");
  pages[0]!.revisions[0]!.slots.main.content = pages[0]!.revisions[0]!.slots.main.content.replace(block, invalid); f.review.games[0]!.linescore = invalid;
  hashes(); expect(build).toThrow("mismatch");
});
