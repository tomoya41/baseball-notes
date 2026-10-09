// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MetricLabel } from "../src/ui/components";
import { metricHelp } from "../src/presentation/metric-help";
import { MemoryRouter } from "react-router-dom";
import mlb from "../public/data/mlb.json";
import { AnalysisScreen } from "../src/ui/analysis";
import { normalizeSample } from "../src/infrastructure/providers/sample-provider";
import { UnavailableAnalysisProvider } from "../src/infrastructure/providers/unavailable-analysis-provider";
import { foundationAnalysisCapabilities } from "../src/app/analysis-policy";
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

describe("analysis filter background scroll", () => {
  it.each(["close", "route-unmount"])("restores document scrolling after %s", async mode => {
    const catalog = normalizeSample(mlb, "MLB");
    await act(async () => root.render(<MemoryRouter><AnalysisScreen catalog={catalog} player={catalog.profiles[0]!.player} provider={new UnavailableAnalysisProvider(foundationAnalysisCapabilities)} /></MemoryRouter>));
    const trigger = host.querySelector(".filter-open")!;
    await click(trigger);
    const dialog = document.querySelector('dialog[aria-label="分析の詳細条件"]')!;
    expect(dialog).not.toBeNull();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(dialog.querySelector(".app-dialog-content")).not.toBeNull();
    if (mode === "close") await act(async () => dialog.dispatchEvent(new Event("close")));
    else await act(async () => root.render(<p>別の画面</p>));
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("auto");
  });
});
