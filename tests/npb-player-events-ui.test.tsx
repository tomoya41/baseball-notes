// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { NpbPlayerEventsScreen } from "../src/ui/npb-player-events";
import { NpbSeasonalHome } from "../src/ui/npb-seasonal-home";
import { readNpbPlayerEvents } from "../src/application/npb-player-events-reader";
import { citation, eventFixture, eventPage, eventPerson, otherEventPerson } from "./fixtures/npb-player-events";
import { parseWikipediaPlayerEvents } from "../src/infrastructure/providers/wikipedia-npb-player-events";
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
  await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/moves${query}`]}>{home ? <NpbSeasonalHome /> : <NpbPlayerEventsScreen favorites={favorites} />}<Location /></MemoryRouter>));
  return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
it("shows source confidence, exact player/team links and accessible per-record evidence without official certification", async () => {
  const f = await mount(); try {
    expect(f.host.textContent).toContain("選手の動き"); expect(f.host.textContent).toContain("公式発表の直接確認"); expect(f.host.textContent).toContain("今季限り");
    expect(f.host.querySelector(`a[href="/NPB/players/${eventPerson.playerId}"]`)).not.toBeNull(); expect(f.host.querySelector('a[href*="oldid=200"]')).not.toBeNull();
    expect(f.host.textContent).toContain("CC BY-SA 4.0"); expect(f.host.textContent).not.toContain("現在所属：阪神");
    const select = f.host.querySelector("select")!; await act(async () => { select.value = "trade"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(f.host.textContent).toContain("この条件の記事記載は未収録です"); expect(f.host.querySelector("[data-location]")?.textContent).toContain("kind=trade"); expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
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
