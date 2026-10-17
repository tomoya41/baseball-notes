import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installAndroidBackHandler } from "../src/app/android-back";

const native = vi.hoisted(() => ({ platform: true, listener: null as null | ((event: { canGoBack: boolean }) => void) }));
const exit = vi.hoisted(() => vi.fn());
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native.platform } }));
vi.mock("@capacitor/app", () => ({ App: {
  addListener: vi.fn(async (_name, callback) => { native.listener = callback; }),
  exitApp: exit,
} }));
const back = vi.fn(), replace = vi.fn();
let dialogs: { close(): void }[];
beforeEach(() => {
  vi.clearAllMocks(); native.platform = true; native.listener = null; dialogs = [];
  vi.stubGlobal("document", { querySelectorAll: () => dialogs });
  vi.stubGlobal("window", { history: { state: { idx: 1 }, back }, location: {
    hash: "#/NPB/players/21a327b4-3924-422a-a1fc-d853e236a201", replace,
  } });
});
afterEach(() => vi.unstubAllGlobals());

it("uses router history when native document history reports no Back entry", async () => {
  await installAndroidBackHandler(); native.listener!({ canGoBack: false });
  expect(back).toHaveBeenCalledOnce(); expect(replace).not.toHaveBeenCalled(); expect(exit).not.toHaveBeenCalled();
});
it.each([0, null, undefined, NaN, -1, 1.5])("uses the safe parent for a cold or invalid router index %s", async idx => {
  window.history.state.idx = idx;
  await installAndroidBackHandler(); native.listener!({ canGoBack: true });
  expect(back).not.toHaveBeenCalled(); expect(replace).toHaveBeenCalledWith("#/NPB/search");
});
it("closes the top dialog before navigating", async () => {
  const close = vi.fn(); dialogs = [{ close: vi.fn() }, { close }];
  await installAndroidBackHandler(); native.listener!({ canGoBack: false });
  expect(close).toHaveBeenCalledOnce(); expect(back).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
});
it("exits only a cold home without a parent", async () => {
  window.history.state.idx = 0; window.location.hash = "#/NPB/home";
  await installAndroidBackHandler(); native.listener!({ canGoBack: true });
  expect(exit).toHaveBeenCalledOnce(); expect(back).not.toHaveBeenCalled();
});
it("does not install an Android handler on Web", async () => {
  native.platform = false; await installAndroidBackHandler(); expect(native.listener).toBeNull();
});
it.each(["npb_cs_first", "npb_cs_final"])("a cold restored CS player returns to the exact %s explorer", async stage => {
  window.history.state.idx = 0;
  window.location.hash = `#/NPB/players/21a327b4-3924-422a-a1fc-d853e236a201/seasons?season=2026&competition=postseason&stage=${stage}&role=pitching`;
  await installAndroidBackHandler(); native.listener!({ canGoBack: false });
  expect(replace).toHaveBeenCalledWith(`#/NPB/cs?season=2026&stage=${stage}&role=pitching`);
});
it("a cold saved-2026 Regular view returns to its Current profile, not unavailable Historical 2026", async () => {
  window.history.state.idx = 0;
  window.location.hash = "#/NPB/players/21a327b4-3924-422a-a1fc-d853e236a201/seasons?season=2026&competition=regular";
  await installAndroidBackHandler(); native.listener!({ canGoBack: false });
  expect(replace).toHaveBeenCalledWith("#/NPB/players/21a327b4-3924-422a-a1fc-d853e236a201");
});
