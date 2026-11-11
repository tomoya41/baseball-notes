// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { NpbPlayerEventsScreen } from "../src/ui/npb-player-events";
import { NpbSeasonalHome } from "../src/ui/npb-seasonal-home";
import { NpbFollowedEventRecords } from "../src/ui/npb-followed-event-records";
import { readNpbPlayerEvents } from "../src/application/npb-player-events-reader";
import { citation, eventFixture, eventPage, eventPerson, otherEventPerson, retirement } from "./fixtures/npb-player-events";
import { parseWikipediaPlayerEvents } from "../src/infrastructure/providers/wikipedia-npb-player-events";
import { appendReviewedNpbEvents } from "../src/infrastructure/providers/npb-event-append";
import type { Favorite } from "../src/domain/models";
import { npbEventQuery } from "../src/domain/npb-event-query";
import { canonicalDeepLink } from "../src/domain/native-navigation";
import { portableRoute } from "../src/domain/product-sharing";
import { clubNewsUrl } from "../src/presentation/npb-club-news";
vi.mock("../src/application/npb-player-events-reader", () => ({ readNpbPlayerEvents: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
function Location() { return <output data-location>{useLocation().search}</output>; }
async function mount(query = "", favorites: Favorite[] = [], failed = false, home = false, dataset = eventFixture()) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.mocked(readNpbPlayerEvents).mockImplementation(async () => { if (failed) throw Error("offline"); return dataset; });
  const host = document.createElement("div"), root = createRoot(host); document.body.append(host);
  await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/moves${query}`]}>{home ? <NpbSeasonalHome now={Date.parse("2026-10-30T03:00:00Z")} /> : <NpbPlayerEventsScreen favorites={favorites} />}<Location /></MemoryRouter>));
  return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
it("shows source confidence, exact player/team links and accessible per-record evidence without official certification", async () => {
  const f = await mount(); try {
    expect(f.host.textContent).toContain("選手の動き"); expect(f.host.textContent).toContain("Wikipediaの記事から一部収録"); expect(f.host.textContent).toContain("今季限り");
    expect(f.host.querySelector(`a[href="/NPB/players/${eventPerson.playerId}"]`)).not.toBeNull(); expect(f.host.querySelector('a[href*="oldid=200"]')).not.toBeNull();
    expect(f.host.textContent).toContain("CC BY-SA 4.0"); expect(f.host.textContent).not.toContain("現在所属：阪神");
    const select = f.host.querySelector("select")!; await act(async () => { select.value = "trade"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(f.host.textContent).toContain("この条件の記事記載は未収録です"); expect(f.host.querySelector("[data-location]")?.textContent).toContain("kind=trade"); expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});
it("opens the 2026 official FA notice from the FA topic without adding official rows", async () => {
  const view = await mount();
  try {
    expect(view.host.querySelector(".event-official-link")).toBeNull();
    const topic = view.host.querySelector<HTMLAnchorElement>('nav[aria-label="選手の動きの種類"] a[href*="kind=fa_declaration"]')!;
    await act(async () => topic.click());
    expect(topic.getAttribute("aria-current")).toBe("page");
    const official = view.host.querySelector<HTMLAnchorElement>(".event-official-link")!;
    expect(official.href).toBe("https://npb.jp/announcement/2026/fa_filed.html");
    expect(official.target).toBe("_blank");
    expect(official.rel).toContain("noreferrer");
    expect(view.host.querySelectorAll(".explorer-result")).toHaveLength(0);
    expect(view.host.textContent).toContain("この条件の記事記載は未収録です");
    expect(readNpbPlayerEvents).toHaveBeenCalledOnce();
  } finally { await view.close(); }
});

it("keeps the official FA destination available when article loading fails and scoped to 2026", async () => {
  const failed = await mount("?season=2026&kind=fa_declaration", [], true);
  try {
    expect(failed.host.textContent).toContain("選手の動きを読み込めません");
    expect(failed.host.querySelector(".event-official-link")).not.toBeNull();
  } finally { await failed.close(); }
  const unsupported = await mount("?season=2027&kind=fa_declaration");
  try { expect(unsupported.host.querySelector(".event-official-link")).toBeNull(); }
  finally { await unsupported.close(); }
});
it("keeps each record's exact article revision after an offseason append", async () => {
  const previous = eventFixture();
  const candidate = parseWikipediaPlayerEvents(
    eventPage(`** 阪神タイガースは、[[架空太郎]]が今季取得した国内FA権を行使することを発表${citation}。`, 201),
    "2026-10-20T00:00:00Z", [eventPerson], "a".repeat(64),
  ).dataset;
  const { id, statementSha256 } = candidate.events[0]!;
  const data = appendReviewedNpbEvents(previous, candidate, {
    previousBodySha256: "b".repeat(64), sourceContentSha256: candidate.source.contentSha256,
    identityInputSha256: candidate.identityInputSha256, additions: [{ id, statementSha256 }],
  });
  const view = await mount("", [], false, false, data);
  try {
    const rows = [...view.host.querySelectorAll("article")];
    const fa = rows.find(row => row.querySelector("h2")?.textContent?.includes("FA宣言"));
    const old = rows.find(row => row.querySelector("h2")?.textContent?.includes("引退発表"));
    expect(fa?.querySelector('a[href*="oldid=201"]')).not.toBeNull();
    expect(fa?.querySelector('a[href*="oldid=200"]')).toBeNull();
    expect(old?.querySelector('a[href*="oldid=200"]')).not.toBeNull();
    expect(old?.querySelector('a[href*="oldid=201"]')).toBeNull();
  } finally { await view.close(); }
});
it("does not fetch an invalid deep link or fetch events when Home merely links to them", async () => {
  const invalid = await mount("?player=not-a-canonical-id"); try { expect(readNpbPlayerEvents).not.toHaveBeenCalled(); expect(invalid.host.textContent).toContain("絞り込み条件"); } finally { await invalid.close(); }
  const home = await mount("", [], false, true); try { expect(readNpbPlayerEvents).not.toHaveBeenCalled(); expect(home.host.querySelector('a[href="/NPB/moves"]')).not.toBeNull(); } finally { await home.close(); }
});
it("reads Favorites without mutating them and distinguishes no observed event from no real event", async () => {
  const favorites: Favorite[] = [{ league: "NPB", kind: "player", entityId: eventPerson.playerId, addedAt: "2026-10-19T00:00:00Z" }];
  const baseline = JSON.stringify(favorites), f = await mount("?follow=1", favorites); try { expect(f.host.textContent).toContain("架空太郎"); expect(JSON.stringify(favorites)).toBe(baseline); } finally { await f.close(); }
  const empty = await mount("?follow=1"); try { expect(empty.host.textContent).toContain("フォローに関連する記事記載は未収録"); expect(empty.host.textContent).toContain("出来事がなかった"); } finally { await empty.close(); }
});
it("loads followed article records on demand and opens the exact licensed record", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const data = parseWikipediaPlayerEvents(eventPage([
    retirement,
    `** 北海道日本ハムファイターズの[[架空太郎]]が金銭トレードで中日ドラゴンズに移籍することを両球団が発表${citation}。`,
    `** 阪神タイガースは、[[架空次郎]]の今季限りでの現役引退を発表${citation}。`,
  ].join("\n")), "2026-10-19T00:00:00Z", [eventPerson, otherEventPerson], "a".repeat(64)).dataset;
  const trade = data.events.find(e => e.kind === "trade")!;
  const favorites: Favorite[] = [
    { league: "NPB", kind: "team", entityId: "npb:team:dragons", addedAt: data.observedAt },
    { league: "NPB", kind: "player", entityId: eventPerson.playerId, addedAt: data.observedAt },
    { league: "MLB", kind: "player", entityId: otherEventPerson.playerId, addedAt: data.observedAt },
  ];
  vi.mocked(readNpbPlayerEvents).mockResolvedValue(data);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={["/NPB/my"]}><Routes>
      <Route path="/NPB/my" element={<NpbFollowedEventRecords favorites={favorites} />} />
      <Route path="/NPB/moves" element={<NpbPlayerEventsScreen favorites={favorites} />} />
    </Routes><Location /></MemoryRouter>));
    expect(readNpbPlayerEvents).not.toHaveBeenCalled();
    const panel = host.querySelector("details")!;
    await act(async () => { panel.open = true; panel.dispatchEvent(new Event("toggle")); });
    expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
    const links = [...panel.querySelectorAll<HTMLAnchorElement>(".player-row")];
    expect(links).toHaveLength(2);
    expect(panel.textContent).not.toContain(otherEventPerson.name);
    expect(panel.querySelector('a[href*="oldid=200"]')).not.toBeNull();
    await act(async () => { panel.open = false; panel.dispatchEvent(new Event("toggle")); });
    await act(async () => { panel.open = true; panel.dispatchEvent(new Event("toggle")); });
    expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
    const link = links.find(a => a.textContent?.includes("トレード"))!;
    const query = new URL(link.href, "https://example.test").search;
    expect(npbEventQuery(new URLSearchParams(query))).toMatchObject({ event: trade.id, player: eventPerson.playerId });
    expect(canonicalDeepLink(`baseballnotes://NPB/moves${query}`)).toBe(portableRoute("/NPB/moves", query));
    await act(async () => link.click());
    expect(host.querySelectorAll("article")).toHaveLength(1);
    expect(host.querySelector("article h2")?.textContent).toBe("架空太郎 · トレード");
    expect(host.querySelector<HTMLDetailsElement>("article details")?.open).toBe(true);
    expect(host.querySelector('article a[href*="oldid=200"]')).not.toBeNull();
    const clear = [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "この記録の指定を解除")!;
    await act(async () => clear.click());
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(readNpbPlayerEvents).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); }
});
it("holds unavailable record IDs without selecting a different record", async () => {
  const f = await mount(`?player=${eventPerson.playerId}&event=npb:event:${"f".repeat(24)}`);
  try {
    expect(f.host.querySelector("article")).toBeNull();
    expect(f.host.textContent).toContain("この条件の記事記載は未収録です");
  } finally { await f.close(); }
  const invalid = await mount("?event=another-kind-of-id");
  try {
    expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
    expect(invalid.host.textContent).toContain("絞り込み条件");
  } finally { await invalid.close(); }
});
it("offers Retry after an acquisition error", async () => {
  const f = await mount("", [], true); try {
    expect(f.host.textContent).toContain("読み込めません"); vi.mocked(readNpbPlayerEvents).mockResolvedValue(eventFixture());
    await act(async () => f.host.querySelector("button")!.click()); expect(f.host.textContent).toContain("架空太郎");
  } finally { await f.close(); }
});
it("filters a compound announcement by the participant's own action without losing source or treating release as FA", async () => {
  const dataset = parseWikipediaPlayerEvents(eventPage(`** 阪神タイガースは、[[架空太郎]]の1選手に来季の契約を結ばないことを通知したこと、[[架空次郎]]を自由契約とすることを発表${citation}。`), "2026-10-19T00:00:00Z", [eventPerson, otherEventPerson], "a".repeat(64)).dataset;
  const f = await mount("?kind=release", [], false, false, dataset); try {
    expect(f.host.querySelectorAll("article")).toHaveLength(1);
    expect(f.host.querySelector("article h2")?.textContent).toBe("架空次郎 · 自由契約");
    expect(f.host.querySelector('article a[href*="oldid=200"]')).not.toBeNull();
    expect(f.host.querySelector('option[value="fa_declaration"]')?.textContent).toContain("未収録");
    const select = f.host.querySelector("select")!; await act(async () => { select.value = "nonrenewal_notice"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(f.host.querySelector("article h2")?.textContent).toBe("架空太郎 · 戦力外通告");
    expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});
it("keeps topic links shareable without discarding player, club, name or Follow scope", async () => {
  const f = await mount(`?player=${eventPerson.playerId}&team=npb:team:tigers&q=架空&follow=1&page=3`);
  try {
    const a = Array.from(f.host.querySelectorAll<HTMLAnchorElement>('.event-topics a')).find(a => a.textContent === '契約更改')!;
    const query = new URL(a.getAttribute('href')!, 'https://example.test').searchParams;
    expect(query.get('kind')).toBe('contract_renewal'); expect(query.get('player')).toBe(eventPerson.playerId);
    expect(query.get('team')).toBe('npb:team:tigers'); expect(query.get('q')).toBe('架空'); expect(query.get('follow')).toBe('1'); expect(query.has('page')).toBe(false);
    await act(async () => a.click());
    expect(f.host.querySelector('.event-topics a[aria-current="page"]')?.textContent).toBe('契約更改');
    expect(npbEventQuery(query).valid).toBe(true);
    expect(portableRoute('/NPB/moves', `?${query}`)).toContain('kind=contract_renewal');
    expect(canonicalDeepLink(`baseballnotes://NPB/moves?${query}`)).toContain('kind=contract_renewal');
    const cold = canonicalDeepLink(`baseballnotes://NPB/moves?${query}`)!;
    expect(new URLSearchParams(cold.split('?')[1]).get('team')).toBe('npb:team:tigers');
    expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});
it("filters only explicit trade destinations and origins, retaining source and other filters", async () => {
  const dataset = parseWikipediaPlayerEvents(eventPage(`** 北海道日本ハムファイターズの[[架空太郎]]が金銭トレードで中日ドラゴンズに移籍することを両球団が発表${citation}。`), "2026-10-19T00:00:00Z", [eventPerson], "a".repeat(64)).dataset;
  const f = await mount("?kind=trade&team=npb:team:dragons&direction=in&q=架空&page=2", [], false, false, dataset);
  try {
    expect(f.host.querySelector("article h2")?.textContent).toBe("架空太郎 · トレード");
    expect(f.host.querySelector('article a[href*="oldid=200"]')).not.toBeNull();
    const directions = f.host.querySelector('nav[aria-label="中日のトレード方向"]')!;
    expect(directions.querySelector('[aria-current="page"]')?.textContent).toBe("加入");
    const out = directions.querySelector<HTMLAnchorElement>('a[href*="direction=out"]')!;
    const share = new URL(out.getAttribute("href")!, "https://example.test").search;
    expect(share).toContain("q=");
    expect(share).not.toContain("page=");
    expect(portableRoute("/NPB/moves", share)).toContain("direction=out");
    expect(canonicalDeepLink(`baseballnotes://NPB/moves${share}`)).toContain("direction=out");
    await act(async () => out.click());
    expect(f.host.querySelector("article")).toBeNull();
    expect(f.host.textContent).toContain("この条件の記事記載は未収録");
    const club = f.host.querySelectorAll("select")[1]!;
    await act(async () => { club.value = "npb:team:fighters"; club.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(f.host.querySelector("article h2")?.textContent).toBe("架空太郎 · トレード");
    const renewal = f.host.querySelector<HTMLAnchorElement>('nav[aria-label="選手の動きの種類"] a[href*="kind=contract_renewal"]')!;
    await act(async () => renewal.click());
    expect(f.host.querySelector("[data-location]")?.textContent).not.toContain("direction=");
    expect(f.host.textContent).toContain("契約更改の記録は未収録です");
    expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});
it.each(["kind=trade&direction=in", "kind=release&team=npb:team:dragons&direction=out", "kind=trade&team=npb:team:dragons&direction=unknown"])(
  "rejects an invalid trade direction without requesting the dataset: %s", async params => {
    const f = await mount(`?${params}`);
    try {
      expect(npbEventQuery(new URLSearchParams(params)).valid).toBe(false);
      expect(f.host.textContent).toContain("絞り込み条件");
      expect(readNpbPlayerEvents).not.toHaveBeenCalled();
    } finally { await f.close(); }
  },
);
it("distinguishes uncollected renewals from no renewals and offers official club navigation without fetching news", async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const all = await mount('?kind=contract_renewal');
  try {
    expect(all.host.textContent).toContain('契約更改の記録は未収録です');
    expect(all.host.textContent).not.toContain('契約更改なし'); expect(all.host.textContent).not.toContain('未発表');
    expect(all.host.querySelectorAll('.club-official-news a')).toHaveLength(12);
    for (const a of all.host.querySelectorAll<HTMLAnchorElement>('.club-official-news a')) { expect(a.protocol).toBe('https:'); expect(a.target).toBe('_blank'); expect(a.rel).toBe('noreferrer'); }
    expect(fetch).not.toHaveBeenCalled();
  } finally { await all.close(); }
  const one = await mount('?kind=contract_renewal&team=npb:team:hawks');
  try {
    expect(one.host.querySelectorAll('.club-official-news a')).toHaveLength(1);
    expect(one.host.querySelector('.club-official-news a')?.getAttribute('href')).toBe('https://www.softbankhawks.co.jp/news/');
    expect(clubNewsUrl('npb:team:unknown')).toBeNull(); expect(clubNewsUrl('https://evil.example')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  } finally { await one.close(); }
});
it("keeps the Home offseason entry compact and does not fetch event or official news data", async () => {
  const f = await mount('', [], false, true);
  try {
    expect(f.host.querySelectorAll('.offseason-home-links a')).toHaveLength(2);
    expect(f.host.querySelector('.offseason-home-links a:last-child')?.getAttribute('href')).toBe('/NPB/moves?kind=contract_renewal');
    expect(readNpbPlayerEvents).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
