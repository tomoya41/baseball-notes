import { expect, it } from "vitest";
import { parseWikipediaPlayerEvents } from "../src/infrastructure/providers/wikipedia-npb-player-events";
import { citation, eventPage, eventPerson, otherEventPerson } from "./fixtures/npb-player-events";
import registry from "../src/data/npb-offseason-event-identity-registry.json";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
const parse = (body: string) => parseWikipediaPlayerEvents(eventPage(body), "2026-10-29T06:00:00Z", [eventPerson, otherEventPerson], "a".repeat(64));
it.each([
  "来季契約を結ばない旨を通知したと",
  "来季契約を結ばないことを通告したと",
  "来季の契約を結ばないことを通達したと",
  "来季の選手契約を締結しない旨を通達したことを",
  "来季の契約を締結しない旨を通達したことを",
])("recovers an exact unambiguous nonrenewal expression without certifying release: %s", ending => {
  const data = parse(`** 阪神タイガースは、[[架空太郎]]に対し${ending}発表${citation}。`).dataset;
  expect(data.events).toHaveLength(1);
  expect(data.events[0]).toMatchObject({ kind: "nonrenewal_notice", status: "encyclopedia_record", effectiveDate: null, fromTeamId: null, toTeamId: null });
});
it("requires the declared headcount and independent IDs for a shared free-contract statement", () => {
  const body = `** 阪神タイガースは、育成の[[架空太郎]]、[[架空次郎]]の2選手に自由契約とすることを通知したと発表${citation}。`;
  expect(parse(body).dataset.events.map(e => e.kind)).toEqual(["release", "release"]);
  const partial = parse(body.replace('[[架空次郎]]', '[[本人未確認]]'));
  expect(partial.dataset.events).toHaveLength(1); expect(partial.issues.map(i => i.reason)).toContain("unresolved_release_participants");
  expect(parse(body.replace('の2選手','の3選手')).dataset.events).toHaveLength(0);
  expect(parse(body.replace('[[架空次郎]]','架空次郎')).dataset.events).toHaveLength(0);
});
it("never interprets an offer, rumor, mixed clause, or uncited statement as an accomplished transaction", () => {
  for (const body of [
    `** 阪神タイガースは、[[架空太郎]]と育成契約を結ぶことを検討${citation}。`,
    `** 阪神タイガースは、[[架空太郎]]に来季の契約を締結しない旨を通達したことと、[[架空次郎]]に育成契約を打診したと発表${citation}。`,
    `** 阪神タイガースは、[[架空太郎]]に対し来季の契約を締結しない旨を通達したことを発表。`,
  ]) expect(parse(body).dataset.events).toHaveLength(0);
});
it("pins the new identity evidence to existing independent UUID/NPB ID/QID bridges only", () => {
  expect(registry.players).toHaveLength(10);
  expect(registry.archiveSha256).toBe("d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092");
  for (const player of registry.players) { expect(() => assertHistoricalBridge(player)).not.toThrow(); expect(player.identityRevision).toBeGreaterThan(0); expect(player.identityContentSha256).toMatch(/^[a-f0-9]{64}$/); }
  for (const key of ["playerId", "npbId", "wikidataId", "article"] as const) expect(new Set(registry.players.map(p => p[key])).size).toBe(registry.players.length);
});
