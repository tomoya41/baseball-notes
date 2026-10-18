import { expect, it } from "vitest";
import { admittedEventIdentities } from "../src/infrastructure/providers/npb-event-identities";
import registry from "../src/data/npb-event-identity-registry.json";
it("binds consumed Directory names to the admission digest without turning names into identity proof", async () => {
  const fixture = { schemaVersion: 2, league: "NPB", effectiveDate: "2026-09-25", generatedAt: "2026-09-26T00:00:00Z",
    teams: Array.from({ length: 12 }, (_, i) => ({ id: `team-${i}`, name: `架空球団${i}`, shortName: `架空${i}` })),
    players: registry.players.slice(0, 2).map((p, i) => ({ playerId: p.playerId, displayName: `架空表示${i}`, teamId: null, position: null, playerType: null, birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null, battingAvailable: false, pitchingAvailable: false, recentAvailable: false })) };
  const before = await admittedEventIdentities(fixture); expect(before.identities).toHaveLength(2);
  const reordered = structuredClone(fixture); reordered.players.reverse(); reordered.generatedAt = "2026-10-01T00:00:00Z";
  expect((await admittedEventIdentities(reordered)).inputSha256).toBe(before.inputSha256);
  fixture.players[0]!.displayName = "架空訂正名"; const after = await admittedEventIdentities(fixture);
  expect(after.inputSha256).not.toBe(before.inputSha256); expect(after.identities.map(p => p.playerId)).toEqual(before.identities.map(p => p.playerId));
  fixture.players[0]!.playerId = "11111111-1111-4111-8111-111111111111";
  expect((await admittedEventIdentities(fixture)).identities).toHaveLength(1);
});
