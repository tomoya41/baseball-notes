// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MetricLabel } from "../src/ui/components";
import { metricHelp } from "../src/presentation/metric-help";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  document.documentElement.style.overflow = "auto";
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.style.overflow = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const click = async (button: Element) => act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
describe("on-demand metric help", () => {
  it.each(["OPS", "OBP", "SLG", "K9", "BF", "RISP", "PA", "AB", "IP"])("opens %s with accessible explanation and closes without losing its trigger", async metric => {
    await act(async () => root.render(<MetricLabel metric={metric} />));
    expect(document.querySelector("dialog")).toBeNull();
    const trigger = host.querySelector("button")!; await click(trigger);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(dialog.textContent).toContain(metricHelp(metric)!.description);
    expect(dialog.querySelector('form[method="dialog"]')).not.toBeNull();
    await act(async () => dialog.dispatchEvent(new Event("close")));
    expect(document.querySelector("dialog")).toBeNull(); expect(host.querySelector("button")).toBe(trigger);
    expect(document.documentElement.style.overflow).toBe("auto");
  });
});
