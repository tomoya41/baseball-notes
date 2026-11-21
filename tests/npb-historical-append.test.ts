import { expect, it } from "vitest";
import { appendHistoricalPlayers } from "../scripts/append-npb-historical-players";
import { historicalPitchingKeys, npbHistoricalDatasetSchema } from "../src/domain/npb-historical";

const knownBridge = { playerId: "3be0c6a2-b9d5-4bed-879d-55f49a597149", npbId: "21325157", wikidataId: "Q115529840" };
const previousBridge = { playerId: "cdd951ef-64f9-48ed-94d4-07114db82c42", npbId: "53755150", wikidataId: "Q107031409" };

function dataset(bridge: typeof knownBridge, observedAt: string) {
  return npbHistoricalDatasetSchema.parse({
    schemaVersion: 1, league: "NPB", coverage: "partial", competition: "regular", temporalScope: "historical",
    granularity: "season_aggregate", license: "CC-BY-SA-4.0", observedAt, inputSha256: "a".repeat(64),
    transformation: "Test only",
    players: [{ ...bridge, name: "Test player", article: "Test player", revision: 1, revisionAt: observedAt, contentSha256: "b".repeat(64) }],
    rows: [{ playerId: bridge.playerId, season: 2025, teamId: "npb:team:hawks", role: "pitching",
      metrics: Object.fromEntries(historicalPitchingKeys.map(key => [key, null])) }],
  });
}

const base = dataset(previousBridge, "2026-10-18T00:00:00Z");
const addition = dataset(knownBridge, "2026-11-21T00:00:00Z");
const input = { base, addition, baseHash: "c".repeat(64), additionHash: "d".repeat(64) };

it("appends new players without rewriting accepted rows and pins both inputs", () => {
  const result = appendHistoricalPlayers(input);
  expect(result.dataset.players).toEqual([...base.players, ...addition.players]);
  expect(result.dataset.rows).toEqual([...base.rows, ...addition.rows]);
  expect(result.dataset.coverage).toBe("partial");
  expect(result.dataset.observedAt).toBe(addition.observedAt);
  expect(appendHistoricalPlayers(input).dataset.inputSha256).toBe(result.dataset.inputSha256);
  expect(appendHistoricalPlayers({ ...input, additionHash: "e".repeat(64) }).dataset.inputSha256)
    .not.toBe(result.dataset.inputSha256);
});

it("rejects existing players, unverified identities and additions without a row", () => {
  expect(() => appendHistoricalPlayers({ ...input, addition: base })).toThrow(/previously uncollected/);
  const invalid = dataset({ ...knownBridge, npbId: "99999999" }, addition.observedAt);
  expect(() => appendHistoricalPlayers({ ...input, addition: invalid })).toThrow(/canonical bridge/);
  expect(() => appendHistoricalPlayers({ ...input, addition: { ...addition, rows: [] } })).toThrow(/verified rows/);
});
