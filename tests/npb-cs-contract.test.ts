import { expect, it } from "vitest";
import { npbCsDatasetSchema } from "../src/domain/npb-cs-observations";
import { historicalBattingKeys } from "../src/domain/npb-historical";

// Invented schema-boundary fixture, never bundled or published as real baseball data.
function fixture() {
  const playerId = "00000000-0000-4000-8000-000000000001", gameId = "npb:game:aaaaaaaaaaaaaaaaaaaa";
  return {
    schemaVersion: 1, league: "NPB", season: 2026, temporalScope: "saved_current", competition: "postseason",
    provider: "Wikipedia", license: "CC-BY-SA-4.0", coverage: "partial", granularity: "collected_game_aggregate",
    observedAt: "2026-10-16T00:00:00Z", inputSha256: "a".repeat(64), transformation: "Invented test fixture",
    sources: [{ pageId: 5301694, title: "テスト", revision: 1, revisionAt: "2026-10-15T00:00:00Z", contentSha256: "b".repeat(64) }],
    players: [{ playerId, name: "架空選手", wikidataId: "Q1", npbId: "1", article: "架空選手", revision: 1, revisionAt: "2026-10-14T00:00:00Z", contentSha256: "c".repeat(64) }],
    games: [{ id: gameId, date: "2026-10-10", stage: "npb_cs_first", homeTeamId: "npb:team:lions", awayTeamId: "npb:team:fighters", homeScore: 1, awayScore: 0, homeHits: null, awayHits: null, sourcePageId: 5301694, status: "final" }],
    rows: [{ aggregate: { playerId, season: 2026, teamId: "npb:team:lions", role: "batting", scope: { league: "NPB", season: 2026, temporalScope: "saved_current", competition: "postseason", stage: "npb_cs_first" }, metrics: { ...Object.fromEntries(historicalBattingKeys.map(k => [k, null])), G: 1 } }, gameIds: [gameId] }],
  };
}
it("keeps observed partial samples and unknown statistics separate from full competition coverage", () => {
  const data = npbCsDatasetSchema.parse(fixture());
  expect(data.coverage).toBe("partial"); expect(data.rows[0]!.aggregate.metrics.PA).toBeNull();
});
it.each(["regular", "preseason"])("rejects %s facts in the CS contract", competition => {
  const data = fixture(); data.rows[0]!.aggregate.scope.competition = competition;
  expect(npbCsDatasetSchema.safeParse(data).success).toBe(false);
});
it("rejects missing game evidence, wrong stage/team, inflated appearance counts and duplicate rows", () => {
  for (const mutate of [
    (d: ReturnType<typeof fixture>) => { d.rows[0]!.gameIds = ["unknown"]; },
    (d: ReturnType<typeof fixture>) => { d.rows[0]!.aggregate.scope.stage = "npb_cs_final"; },
    (d: ReturnType<typeof fixture>) => { d.rows[0]!.aggregate.teamId = "npb:team:giants"; },
    (d: ReturnType<typeof fixture>) => { d.rows[0]!.aggregate.metrics.G = 2; },
    (d: ReturnType<typeof fixture>) => { d.rows.push(d.rows[0]!); },
  ]) { const data = fixture(); mutate(data); expect(npbCsDatasetSchema.safeParse(data).success).toBe(false); }
});
it("rejects future evidence and unknown canonical identities without name-based repair", () => {
  const future = fixture(); future.players[0]!.revisionAt = "2026-10-17T00:00:00Z";
  expect(npbCsDatasetSchema.safeParse(future).success).toBe(false);
  const unknown = fixture(); unknown.rows[0]!.aggregate.playerId = "00000000-0000-4000-8000-000000000002";
  expect(npbCsDatasetSchema.safeParse(unknown).success).toBe(false);
});
