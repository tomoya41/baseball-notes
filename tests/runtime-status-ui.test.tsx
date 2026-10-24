// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RuntimeStatus } from "../src/ui/runtime-status";
const network = vi.hoisted(() => ({ online: true, saved: false }));
vi.mock("../src/app/mobile-services", () => ({ publicNetworkOnline: () => network.online, hasSavedResponseFallback: () => network.saved, favoriteNotifications: {} }));

it("exposes the exact network status to accessibility and never lets saved data mask offline state", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(<RuntimeStatus />));
    expect(host.querySelector('[role="status"]')).toBeNull();
    network.online = false;
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(host.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('オフライン');
    network.saved = true;
    await act(async () => window.dispatchEvent(new Event("baseball:saved-data")));
    const offline = host.querySelector('[role="status"]')!;
    expect(offline.getAttribute('aria-label')).toBe(offline.textContent);
    expect(offline.textContent).toContain('オフライン');
    expect(offline.textContent).toContain('保存済みデータ');
    network.online = true;
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(host.textContent).toBe('保存済みデータを表示しています');
    network.saved = false;
    await act(async () => window.dispatchEvent(new Event("baseball:refresh-data")));
    expect(host.querySelector('[role="status"]')).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
    network.online = true; network.saved = false;
  }
});
