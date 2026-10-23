// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/platform", () => ({ isAndroid: () => false }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });
function environment(waiting = true) {
  const worker = Object.assign(new EventTarget(), { state: "installed", postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), { waiting: waiting ? worker : null, installing: null, active: { state: "activated" }, update: vi.fn().mockResolvedValue(undefined) });
  const container = Object.assign(new EventTarget(), { controller: {}, register: vi.fn().mockResolvedValue(registration) });
  return { worker, registration, container: container as unknown as ServiceWorkerContainer };
}
describe("Web app update consent", () => {
  it("preserves URL/state until explicit update, handles another tab, and bounds update checks", async () => {
    vi.useFakeTimers(); const mod = await import("../src/app/web-offline"), h = environment(), reload = vi.fn();
    const dispose = await mod.connectWebOffline(h.container, new URL("https://example.test/baseball-notes/"), reload);
    expect(h.container.register).toHaveBeenCalledWith(new URL("https://example.test/baseball-notes/sw.js"), { scope: "/baseball-notes/", updateViaCache: "none" });
    expect(mod.webOfflineState().updateAvailable).toBe(true); expect(h.worker.postMessage).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("focus")); expect(h.registration.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15 * 60 * 1000); window.dispatchEvent(new Event("focus")); expect(h.registration.update).toHaveBeenCalledOnce();
    h.container.dispatchEvent(new Event("controllerchange")); expect(reload).not.toHaveBeenCalled(); expect(mod.webOfflineState().updateAvailable).toBe(true);
    mod.applyWebUpdate(); expect(reload).toHaveBeenCalledOnce(); dispose();
  });
  it("shows the update action, reloads only after activation, and can retry failed activation", async () => {
    vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const mod = await import("../src/app/web-offline"), { WebAppUpdateNotice } = await import("../src/ui/web-offline"), h = environment(), reload = vi.fn();
    const dispose = await mod.connectWebOffline(h.container, new URL("https://example.test/"), reload);
    const host = document.createElement("div"), root = createRoot(host);
    await act(async () => root.render(<WebAppUpdateNotice />));
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(h.worker.postMessage).toHaveBeenCalledWith({ type: "ACTIVATE_WEB_UPDATE" }); expect(reload).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(10000)); expect(host.textContent).toContain("再試行"); expect((host.querySelector("button") as HTMLButtonElement).disabled).toBe(false);
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    h.container.dispatchEvent(new Event("controllerchange")); expect(reload).toHaveBeenCalledOnce(); dispose(); await act(async () => root.unmount());
  });
});
