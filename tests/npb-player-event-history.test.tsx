// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { NpbPlayerEventHistory } from "../src/ui/npb-player-event-history";
import { readNpbPlayerEvents } from "../src/application/npb-player-events-reader";
import { eventFixture, eventPerson, otherEventPerson } from "./fixtures/npb-player-events";
import type { NpbPlayerEvents } from "../src/domain/npb-player-events";
vi.mock("../src/application/npb-player-events-reader", () => ({ readNpbPlayerEvents: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function mount(playerId = eventPerson.playerId) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.mocked(readNpbPlayerEvents).mockResolvedValue(eventFixture());
  const host = document.createElement("div"), root = createRoot(host); document.body.append(host);
  const render = async (id: string) => { await act(async () => root.render(<MemoryRouter><NpbPlayerEventHistory playerId={id} /></MemoryRouter>)); };
  await render(playerId);
  const toggle = async (open: boolean) => {
    await act(async () => { const d = host.querySelector("details")!; d.open = open; d.dispatchEvent(new Event("toggle")); });
    // Wait for the genuinely lazy chunk and Suspense paint, not just the disclosure's summary text.
    for (let i = 0; i < 30 && !host.querySelector('a[href*="/NPB/moves?player="]') && !host.textContent?.includes("読み込めません"); i++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    }
  };
  return { host, render, toggle, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
it("defers chunk/data acquisition until explicit expansion and retains the result across collapse/reopen", async () => {
  const f = await mount(); try {
    expect(readNpbPlayerEvents).not.toHaveBeenCalled(); await f.toggle(true);
    expect(f.host.textContent).toContain("引退発表"); expect(f.host.querySelector('a[href*="oldid=200"]')).not.toBeNull();
    expect(f.host.textContent).toContain("CC BY-SA 4.0"); expect(f.host.textContent).toContain("現在の所属や登録の認定ではありません");
    await f.toggle(false); await f.toggle(true); expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
    expect(f.host.querySelector(`a[href="/NPB/moves?player=${eventPerson.playerId}"]`)).not.toBeNull();
  } finally { await f.close(); }
});
it("does not associate a same-name different ID and clears the previous player's evidence on navigation", async () => {
  const f = await mount(); try {
    await f.toggle(true); expect(f.host.textContent).toContain("阪神");
    await f.render(otherEventPerson.playerId); expect(f.host.textContent).not.toContain("阪神"); expect(readNpbPlayerEvents).toHaveBeenCalledTimes(1);
    const d = eventFixture(); d.players.push({ ...otherEventPerson, name: eventPerson.name }); vi.mocked(readNpbPlayerEvents).mockResolvedValue(d);
    await f.toggle(true); expect(f.host.textContent).toContain("この選手の出来事は未収録"); expect(f.host.textContent).not.toContain("阪神");
  } finally { await f.close(); }
});
it("shows a failure with Retry, then a bounded newest-first history rather than treating error as no events", async () => {
  const f = await mount(); try {
    vi.mocked(readNpbPlayerEvents).mockRejectedValueOnce(Error("offline")); await f.toggle(true);
    expect(f.host.textContent).toContain("読み込めません"); expect(f.host.textContent).not.toContain("出来事は未収録");
    const d: NpbPlayerEvents = eventFixture(); d.events = Array.from({ length: 7 }, (_, i) => ({ ...d.events[0]!, id: `npb:event:${String(i).padStart(24, "0")}`, recordedDate: `2026-09-${String(i + 1).padStart(2, "0")}` }));
    vi.mocked(readNpbPlayerEvents).mockResolvedValue(d); await act(async () => f.host.querySelector("button")!.click());
    const rows = f.host.querySelectorAll(".lifecycle-timeline li"); expect(rows).toHaveLength(5); expect(rows[0]!.textContent).toContain("2026-09-07"); expect(f.host.textContent).toContain("7件");
  } finally { await f.close(); }
});
it.each(["", "name-only", "npb:player:unknown"])("never reads events for an invalid identity %s", async id => {
  const f = await mount(id); try { expect(f.host.textContent).toBe(""); expect(readNpbPlayerEvents).not.toHaveBeenCalled(); } finally { await f.close(); }
});
