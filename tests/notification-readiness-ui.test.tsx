// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationSettings } from "../src/ui/runtime-status";
const native = vi.hoisted(() => ({ android: true }));
const notifications = vi.hoisted(() => ({ enabled: vi.fn(), readiness: vi.fn(), sync: vi.fn(), setEnabled: vi.fn() }));
vi.mock("../src/app/platform", () => ({ isAndroid: () => native.android }));
vi.mock("../src/app/mobile-services", () => ({ favoriteNotifications: notifications }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); native.android = true;
  notifications.enabled.mockReset().mockResolvedValue(false); notifications.readiness.mockReset().mockResolvedValue({ configured: false, granted: false });
  notifications.sync.mockReset().mockResolvedValue(undefined); notifications.setEnabled.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const mount = async () => act(async () => root.render(<NotificationSettings favorites={[]} ready visible />));
describe("external delivery readiness is separate from in-app Watch", () => {
  it("does not invite opt-in to unconfigured push", async () => {
    await mount(); expect(container.textContent).toContain("未設定・利用準備中");
    expect((container.querySelector('[role="switch"]') as HTMLButtonElement).disabled).toBe(true);
    expect(notifications.setEnabled).not.toHaveBeenCalled();
  });
  it("allows an existing ON setting to be disabled even if external configuration is missing", async () => {
    notifications.enabled.mockResolvedValueOnce(true).mockResolvedValue(false); await mount();
    const button = container.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false); await act(async () => button.click());
    expect(notifications.setEnabled).toHaveBeenCalledExactlyOnceWith(false, []); expect(button.getAttribute("aria-checked")).toBe("false");
  });
  it("contains a secondary settings read failure after an unsuccessful toggle", async () => {
    notifications.readiness.mockResolvedValue({ configured: true, granted: false });
    notifications.enabled.mockResolvedValueOnce(false).mockRejectedValue(Error("storage"));
    notifications.setEnabled.mockRejectedValue(Error("保存できません")); await mount();
    const button = container.querySelector('[role="switch"]') as HTMLButtonElement;
    await act(async () => button.click()); expect(container.textContent).toContain("保存できません"); expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-checked")).toBe("false");
  });
  it("keeps a first settings read failure safe and makes no browser delivery claim", async () => {
    notifications.enabled.mockRejectedValue(Error("storage")); await mount(); expect(container.textContent).toContain("設定は保持しています");
    native.android = false; await mount(); expect(container.textContent).toContain("Webからは配信しません");
  });
});
