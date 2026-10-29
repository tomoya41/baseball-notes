import { expect, it } from "vitest";
import { parseWikipediaPlayerEvents } from "../src/infrastructure/providers/wikipedia-npb-player-events";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
import { citation, eventPage, eventPerson, otherEventPerson } from "./fixtures/npb-player-events";
import registry from "../src/data/npb-offseason-recovery-identity-registry.json";
const parse = (body: string) => parseWikipediaPlayerEvents(eventPage(body), "2026-10-29T05:13:42.178Z", [eventPerson, otherEventPerson], "a".repeat(64));
it("retains a player's explicit self-announcement as an article record without certifying a retirement date", () => {
  const d = parse(`** 阪神タイガースの[[架空太郎]]が、今季限りでの現役引退を発表${citation}。`).dataset;
  expect(d.events).toHaveLength(1);
  expect(d.events[0]).toMatchObject({ playerId: eventPerson.playerId, kind: "retirement_announcement", status: "encyclopedia_record", effectiveDate: null, announcementDate: null, relatedTeamIds: ["npb:team:tigers"] });
});
it("requires both independent linked identities for the exact two-person retirement sentence", () => {
  const body = `** 阪神タイガースは、[[架空太郎]]と[[架空次郎]]が今季限りで現役を引退することを発表${citation}。`;
  const events = parse(body).dataset.events;expect(events).toHaveLength(2);
  expect(new Set(events.map(e=>e.statementSha256)).size).toBe(1);
  expect(events.map(e=>e.playerId).sort()).toEqual([eventPerson.playerId,otherEventPerson.playerId].sort());
  expect(events.every(e=>e.kind==="retirement_announcement"&&e.effectiveDate===null)).toBe(true);
  for(const invalid of [body.replace('[[架空次郎]]','[[未確認次郎]]'),body.replace('[[架空次郎]]','架空次郎'),body.replace('[[架空次郎]]','[[架空太郎]]'),body.replace('引退することを','引退する可能性を'),body.replace(citation,'')])expect(parse(invalid).dataset.events).toHaveLength(0);
});
it.each(["支配下契約を締結したと", "支配下契約を締結したことを", "支配下選手契約を結んだと", "支配下契約を結んだことを"])("recovers an exact completed registration wording: %s", ending => {
  const e=parse(`** 阪神タイガースは、育成選手の[[架空太郎]]と${ending}発表${citation}。`).dataset.events[0]!;
  expect(e).toMatchObject({kind:"registration_change",effectiveDate:null,announcementDate:null});expect(e.excerpt).not.toContain('背番号');
});
it.each([
  "へ来季の契約を結ばないことを通告したと",
  "に対し、来季の契約を行わない旨を通告したと",
  "に来季契約を行わない旨を通知したことを",
])("splits only an exact shared nonrenewal statement with a matching count: %s", ending => {
  const body=`** 阪神タイガースは、[[架空太郎]]、[[架空次郎]]の2選手${ending}発表${citation}。`;
  expect(parse(body).dataset.events.map(e=>e.kind)).toEqual(['nonrenewal_notice','nonrenewal_notice']);
  expect(parse(body.replace('の2選手','の3選手')).dataset.events).toHaveLength(0);
  const partial=parse(body.replace('[[架空次郎]]','[[未照合次郎]]'));expect(partial.dataset.events).toHaveLength(1);expect(partial.issues.map(i=>i.reason)).toContain('unresolved_notice_participants');
});
it.each([
  `** 阪神タイガースは、[[架空太郎]]へ来季の支配下契約を結ばない旨を通知し、育成契約を打診したと発表${citation}。`,
  `** 阪神タイガースは、[[架空太郎]]の1選手に来季の契約を結ばないことを通告したことと、別選手のポスティングを容認すると発表${citation}。`,
  `** 阪神タイガースは、育成選手の[[架空太郎]]と支配下契約を結ぶ見込みと発表${citation}。`,
  `** 阪神タイガースの[[架空太郎]]が、今季限りでの現役引退を検討${citation}。`,
  `** 阪神タイガースの架空太郎が、今季限りでの現役引退を発表${citation}。`,
])("holds mixed scope, offers, predictions and unlinked names: %s", body=>{expect(parse(body).dataset.events).toHaveLength(0);});
it("keeps new evidence collision-free in the existing canonical namespace",()=>{
  expect(registry.players).toHaveLength(22);expect(registry.archiveSha256).toBe('d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092');
  for(const p of registry.players){expect(()=>assertHistoricalBridge(p)).not.toThrow();expect(p.identityContentSha256).toMatch(/^[a-f0-9]{64}$/);expect(p.identityRevision).toBeGreaterThan(0);}
  for(const key of ['playerId','npbId','wikidataId','article'] as const)expect(new Set(registry.players.map(p=>p[key])).size).toBe(registry.players.length);
});
