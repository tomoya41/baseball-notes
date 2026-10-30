import { expect, it } from "vitest";
import { npbHomeContext, relevantJapanSeries, homeMovementRecords } from "../src/presentation/npb-home-context";
import { buildWikipediaJapanSeries } from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import { japanResultFixture } from "./fixtures/npb-japan-series";
import { eventFixture, eventPerson, otherEventPerson } from "./fixtures/npb-player-events";
import type { Favorite } from "../src/domain/models";

const now = Date.parse("2026-10-25T03:00:00Z");
function series() { const f = japanResultFixture(); return buildWikipediaJapanSeries(f.archive, f.cs, "b".repeat(64), f.admission, f.review, f.now); }
function events() { const d = eventFixture(); d.observedAt = "2026-10-25T01:00:00Z"; d.events[0]!.recordedDate = "2026-10-24"; return d; }
const follow = (entityId: string, kind: "player" | "team" = "player") => ({league:"NPB",kind,entityId}) as Favorite;

it("features a recent verified result, respects user scope and never declares an overdue result completed", () => {
  const d = series();
  expect(relevantJapanSeries(d, now)).toBe(true);
  expect(npbHomeContext(now, null, d, events(), []).focus).toBe("series");
  expect(npbHomeContext(now, "regular", d, events(), [])).toMatchObject({focus:"scores",wantsSeries:false,wantsMovements:false});
  expect(npbHomeContext(now, "spring", d, events(), []).focus).toBe("seasonal");
  expect(npbHomeContext(now, "winter", d, events(), []).focus).toBe("moves");
  const later = Date.parse("2026-10-30T03:00:00Z");
  expect(relevantJapanSeries(d, later)).toBe(false);
  expect(npbHomeContext(later, null, d, events(), []).focus).toBe("moves");
  expect(d.series.clinched).toBe(false);
});
it("does not promote future snapshots, far-away schedules or a stale pregame snapshot", () => {
  const d = series(); d.observedAt = "2026-10-26T00:00:00Z";
  expect(relevantJapanSeries(d, now)).toBe(false);
  d.observedAt = "2026-10-24T00:00:00Z"; d.results = []; d.series.games = d.series.games.slice(1);
  expect(relevantJapanSeries(d, now)).toBe(true);
  d.observedAt = "2026-10-20T00:00:00Z"; expect(relevantJapanSeries(d, now)).toBe(false);
  expect(relevantJapanSeries(d, Date.parse("2027-10-25T03:00:00Z"))).toBe(false);
});
it("can retain a fresh Japan Series headline in November, independently of the calendar's winter discovery mode", () => {
  const d=series(), november=Date.parse("2026-11-01T03:00:00Z");
  d.observedAt="2026-11-01T01:00:00Z";
  d.series.games=d.series.games.slice(0,1); d.series.games[0]!.date="2026-10-31";
  expect(npbHomeContext(november,null,d,null,[])).toMatchObject({focus:"series",wantsSeries:true,season:{mode:"winter"}});
  expect(npbHomeContext(november,"winter",d,null,[])).toMatchObject({focus:"seasonal",wantsSeries:false});
});
it("keeps dated records for 14 JST calendar days, deduplicates people and prioritizes independent favorite IDs", () => {
  const d = events(), first = d.events[0]!;
  d.players.push({...d.players[0]!,...otherEventPerson});
  d.events.push({...first,id:"second",playerId:otherEventPerson.playerId,recordedDate:"2026-10-23"});
  d.events.push({...first,id:"older",recordedDate:"2026-10-22"});
  expect(homeMovementRecords(d, now, [follow(otherEventPerson.playerId)]).map(r=>r.event.id)).toEqual(["second",first.id]);
  expect(homeMovementRecords(d, now, [follow(first.relatedTeamIds[0]!, "team")]).every(r=>r.followed)).toBe(true);
  expect(homeMovementRecords(d, now, [{...follow(otherEventPerson.playerId),league:"MLB"}]).map(r=>r.event.id)).toEqual([first.id,"second"]);
  d.events = [{...first,recordedDate:"2026-10-12"}]; expect(homeMovementRecords(d, now, [])).toHaveLength(1);
  d.events[0]!.recordedDate = "2026-10-11"; expect(homeMovementRecords(d, now, [])).toHaveLength(0);
  d.events[0]!.recordedDate = "2026-10-26"; expect(homeMovementRecords(d, now, [])).toHaveLength(0);
  d.observedAt = "2026-10-25T04:00:00Z"; expect(homeMovementRecords(d, now, [])).toHaveLength(0);
  expect(eventPerson.playerId).not.toBe(otherEventPerson.playerId);
});
it("uses fresh movement records in winter, falls back to editorial navigation without inventing absence, and changes at JST midnight", () => {
  const d = events();
  expect(npbHomeContext(Date.parse("2026-11-01T03:00:00Z"),null,series(),d,[]).focus).toBe("moves");
  expect(npbHomeContext(Date.parse("2026-11-15T03:00:00Z"),null,series(),d,[]).focus).toBe("seasonal");
  expect(npbHomeContext(Date.parse("2026-03-31T14:59:59Z"),null,null,null,[]).focus).toBe("seasonal");
  expect(npbHomeContext(Date.parse("2026-03-31T15:00:00Z"),null,null,null,[]).focus).toBe("scores");
});
