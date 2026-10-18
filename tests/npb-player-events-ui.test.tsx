// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { NpbPlayerEventsScreen } from "../src/ui/npb-player-events";
import { NpbSeasonalHome } from "../src/ui/npb-seasonal-home";
import { readNpbPlayerEvents } from "../src/application/npb-player-events-reader";
import { eventFixture, eventPerson } from "./fixtures/npb-player-events";
import type { Favorite } from "../src/domain/models";
vi.mock("../src/application/npb-player-events-reader", () => ({ readNpbPlayerEvents: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
function Location() { return <output data-location>{useLocation().search}</output>; }
async function mount(query = "", favorites: Favorite[] = [], failed = false, home = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.mocked(readNpbPlayerEvents).mockImplementation(async () => { if (failed) throw Error("offline"); return eventFixture(); });
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
