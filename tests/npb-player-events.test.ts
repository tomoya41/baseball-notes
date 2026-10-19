import { describe, expect, it } from "vitest";
import { parseWikipediaPlayerEvents } from "../src/infrastructure/providers/wikipedia-npb-player-events";
import { npbPlayerEventsSchema, compareEventSnapshots } from "../src/domain/npb-player-events";
import { npbEventQuery } from "../src/domain/npb-event-query";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import { citation, eventFixture, eventPage, eventPerson, otherEventPerson, retirement } from "./fixtures/npb-player-events";
const parse = (body: string) => parseWikipediaPlayerEvents(eventPage(body), "2026-10-19T00:00:00Z", [eventPerson, otherEventPerson], "a".repeat(64));
describe("explicit sourced movement observations", () => {
  it("retains reported date/provenance, never certifies a roster, retirement effective date or official announcement", () => {
    const d = eventFixture(), e = d.events[0]!;
    expect(e).toMatchObject({ kind: "retirement_announcement", recordedDate: "2026-09-28", status: "encyclopedia_record", fromTeamId: null, toTeamId: null, announcementDate: null, effectiveDate: null });
    expect(d.coverage).toBe("partial"); expect(d.source.url).toContain("oldid=200"); expect(e.excerpt).toContain("今季限り"); expect(e.excerpt).not.toContain("<ref>");
  });
  it.each([
    [`** 北海道日本ハムファイターズの[[架空太郎]]が金銭トレードで中日ドラゴンズに移籍することを両球団が発表${citation}。`, "trade"],
    [`** 阪神タイガースは、育成選手の[[架空太郎]]と支配下選手契約を結んだことを発表。背番号は128→'''85'''${citation}。`, "registration_change"],
    [`** 阪神タイガースは、[[架空太郎]]と育成選手契約を締結したことを発表${citation}。`, "signing"],
    [`** 阪神タイガースは、[[架空太郎]]に自由契約を通達したと発表${citation}。`, "release"],
    [`** 阪神タイガースは、[[架空太郎]]に来季の契約を結ばない旨を通知したことを発表${citation}。`, "nonrenewal_notice"],
  ])("interprets only the explicit event grammar: %s", (body, kind) => {
    const e = parse(body).dataset.events[0]!; expect(e.kind).toBe(kind);
    if (kind === "trade") expect([e.fromTeamId, e.toTeamId]).toEqual(["npb:team:fighters", "npb:team:dragons"]);
    else expect([e.fromTeamId, e.toTeamId]).toEqual([null, null]);
  });
  it("splits an unambiguous shared nonrenewal notice by independently matched IDs, preserving the single shared evidence", () => {
    const body = `** 阪神タイガースは、[[架空太郎]]、育成の[[架空次郎]]の2選手に、来季の契約を結ばない旨を通知したことを発表${citation}。架空次郎は現役引退を表明${citation}。`;
    const d = parse(body).dataset;
    expect(d.events).toHaveLength(2); expect(new Set(d.events.map(e => e.playerId)).size).toBe(2);
    expect(d.events.every(e => e.kind === "nonrenewal_notice" && e.effectiveDate === null && e.fromTeamId === null && e.toTeamId === null)).toBe(true);
    expect(new Set(d.events.map(e => e.statementSha256)).size).toBe(1);
    expect(d.events[0]!.excerpt).not.toContain("引退");
    const partial = parse(body.replace("[[架空次郎]]", "[[未照合次郎]]"));
    expect(partial.dataset.events).toHaveLength(1); expect(partial.dataset.events[0]!.playerId).toBe(eventPerson.playerId);
    expect(partial.issues.map(i => i.reason)).toContain("unresolved_notice_participants");
  });
  it.each([
    `** 阪神タイガースは、[[架空太郎]]、[[架空次郎]]の3選手に、来季の契約を結ばない旨を通知したことを発表${citation}。`,
    `** 阪神タイガースは、[[架空太郎]]、架空次郎の2選手に、来季の契約を結ばない旨を通知したことを発表${citation}。`,
    `** 阪神タイガースは、[[架空太郎]]、[[架空太郎]]の2選手に、来季の契約を結ばない旨を通知したことを発表${citation}。`,
    `** 阪神タイガースは、[[架空太郎]]と[[架空次郎]]に自由契約を通達したと発表${citation}。`,
    `** 阪神タイガースは、[[架空太郎]]に来季の支配下契約を結ばない旨を通知し、育成選手契約を打診したことを発表${citation}。`,
    `** 阪神タイガースは、[[架空太郎]]に来季の契約を結ばない可能性を発表${citation}。`,
  ])("holds ambiguous/count-mismatched/differently scoped notices: %s", body => { expect(parse(body).dataset.events).toHaveLength(0); });
  it("never converts past nonrenewal or a waiver request into free agency or another new notice", () => {
    for (const body of [
      `** 阪神タイガースは、前年に戦力外となっていた[[架空太郎]]の現役引退を発表${citation}。`,
      `** 阪神タイガースは、[[架空太郎]]のウェーバー公示申請を発表${citation}。後に自由契約となった${citation}。`,
    ]) expect(parse(body).dataset.events).toHaveLength(0);
  });
  it("rejects source text that impersonates parser-owned identity, team or citation markers", () => {
    expect(() => parse(retirement.replace(citation, "§REF§"))).toThrow("Reserved reference marker");
    for (const body of [
      `** @tigers@は、[[架空太郎]]に来季の契約を結ばない旨を通知したことを発表${citation}。`,
      `** 阪神タイガースは、[[架空太郎]]、@PLAYER@の1選手に、来季の契約を結ばない旨を通知したことを発表${citation}。`,
    ]) expect(parse(body).dataset.events).toHaveLength(0);
  });
  it.each([
    retirement.replace("[[架空太郎]]", "架空太郎"), retirement.replace("[[架空太郎]]", "[[未照合太郎|架空太郎]]"),
    retirement.replace("[[架空太郎]]", "[[架空太郎]]と[[架空次郎]]"), retirement.replace("の今季限りでの", "の引退予想と今季限りでの"),
    retirement.replace(citation, ""), retirement.replace("今季限りでの現役引退を発表", "引退する可能性を報道"),
    retirement.replace("阪神タイガース", "阪神タイガースファーム"), retirement.replace("今季限りでの", "「指示を実行」今季限りでの"),
  ])("quarantines names, ambiguous groups, unsupported predictions/quotes and missing evidence", body => {
    expect(parse(body).dataset.events).toHaveLength(0); expect(parse(body).issues).toHaveLength(1);
  });
  it("does not assign an unsupported day or heading the previous date", () => {
    expect(parse(`${retirement}\n* 29日\n${retirement}`).dataset.events).toHaveLength(1);
    expect(parse(`=== 不明な月 ===\n${retirement}`).dataset.events).toHaveLength(0);
    expect(parse(`* [[8月28日|28日]]\n${retirement}`).dataset.events).toHaveLength(0);
  });
  it("never lets a self-closing reference consume following rows, comments, or a different section", () => {
    const d = parse(`${retirement.replace(citation, '<ref name="prior"/>')}\n* [[9月29日|29日]]\n${retirement}`).dataset;
    expect(d.events).toHaveLength(2);
    expect(parse(`<!-- ${retirement} -->\n== 別の項目 ==\n${retirement}`).dataset.events).toHaveLength(0);
  });
  it("uses JST for future-date rejection and real instants for same-second revision ordering", () => {
    const page = eventPage(retirement); page.revisions[0]!.slots.main.content = page.revisions[0]!.slots.main.content.replaceAll("9月", "10月").replaceAll("28日", "19日"); page.revisions[0]!.timestamp = "2026-10-18T23:00:00Z";
    expect(parseWikipediaPlayerEvents(page, "2026-10-18T23:00:00.001Z", [eventPerson], "a".repeat(64)).dataset.events).toHaveLength(1);
    expect(() => parseWikipediaPlayerEvents(page, "2026-10-18T14:59:00Z", [eventPerson], "a".repeat(64))).toThrow();
    page.revisions[0]!.timestamp = "2026-10-18T14:00:00Z";
    expect(parseWikipediaPlayerEvents(page, "2026-10-18T14:59:00Z", [eventPerson], "a".repeat(64)).dataset.events).toHaveLength(0);
  });
  it("keeps replay idempotent and marks disappearance for review rather than inferring a retraction", () => {
    const d = eventFixture(); expect(parse(`${retirement}\n${retirement}`).dataset.events).toHaveLength(1);
    expect(compareEventSnapshots(d, structuredClone(d)).added).toEqual([]);
    const corrected = structuredClone(d); corrected.events[0]!.excerpt += "訂正";
    expect(compareEventSnapshots(d, corrected).changed).toEqual([d.events[0]!.id]);
    const renamed = structuredClone(d); renamed.players[0]!.name = "架空登録名の訂正";
    expect(compareEventSnapshots(d, renamed).playersChanged).toEqual([d.players[0]!.playerId]);
    renamed.identityInputSha256 = "c".repeat(64); expect(compareEventSnapshots(d, renamed).identityInputChanged).toBe(true);
    const empty = { ...structuredClone(d), events: [] }; expect(compareEventSnapshots(d, empty).removed).toEqual([d.events[0]!.id]);
    expect(d.events[0]!.status).toBe("encyclopedia_record");
  });
  it("rejects official/rumor promotion, foreign/unknown identity, forged provenance and source-future snapshots", () => {
    for (const mutate of [(d: ReturnType<typeof eventFixture>) => { d.events[0]!.playerId = otherEventPerson.playerId; }, (d: ReturnType<typeof eventFixture>) => { d.source.url = "https://npb.jp/"; }, (d: ReturnType<typeof eventFixture>) => { d.events[0]!.effectiveDate = "2026-10-19" as never; }]) { const d = eventFixture(); mutate(d); expect(npbPlayerEventsSchema.safeParse(d).success).toBe(false); }
    const d = eventFixture(); expect(npbPlayerEventsSchema.safeParse({ ...d, events: [{ ...d.events[0]!, status: "official_announcement" }] }).success).toBe(false);
  });
});
it("preserves bounded event query, share/native scope and cold Back while discarding unknown keys", () => {
  const q = `?player=${eventPerson.playerId}&team=npb:team:tigers&kind=retirement_announcement&page=2&secret=not-shared`;
  expect(portableRoute("/NPB/moves", q)).not.toContain("secret");
  expect(canonicalDeepLink(`baseballnotes://NPB/moves${q}`)).toContain(eventPerson.playerId);
  expect(parentNativeRoute(`/NPB/moves${q}`)).toBe(`/NPB/players/${eventPerson.playerId}`);
  for (const query of ["?season=2025", "?kind=rumor", "?team=not-a-team", "?page=NaN", "?page=0", "?player=name", "?follow=maybe"]) { expect(npbEventQuery(new URLSearchParams(query)).valid).toBe(false); expect(portableRoute("/NPB/moves", query)).toBeNull(); }
});
