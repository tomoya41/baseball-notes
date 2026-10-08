// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewportPages } from "../src/ui/viewport-pages";
import { MetricLabel } from "../src/ui/components";
import { metricHelp } from "../src/presentation/metric-help";

let host: HTMLDivElement, root: Root, resize: () => void;
let width = 320, content = 1008;
const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
async function flush() { await act(async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f(0)); }); }
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { frames.set(++frameId, f); return frameId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => content);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); width = 320; content = 1008;
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); frames.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const click = async (button: Element) => act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("viewport pages", () => {
  it("offers all pages without changing or duplicating the data tree", async () => {
    await act(async () => root.render(<ViewportPages><a href="/player">選手</a><p>記録</p></ViewportPages>)); await flush();
    const next = host.querySelector('[aria-label="次のページ"]')!;
    expect(host.querySelector('[role="status"]')!.textContent).toBe("1 / 3");
    await click(next); expect(host.querySelector('[role="status"]')!.textContent).toBe("2 / 3");
    expect(host.querySelector(".viewport-pages-window")!.scrollLeft).toBe(344);
    await click(next); expect(next.hasAttribute("disabled")).toBe(true);
    expect(host.querySelectorAll("a")).toHaveLength(1);
  });
  it("reflows after async content and resize, bounds the active page, and resets on route change", async () => {
    const render = (key: string) => act(async () => root.render(<ViewportPages resetKey={key}><p>内容</p></ViewportPages>));
    await render("first"); await flush(); await click(host.querySelector('[aria-label="次のページ"]')!);
    content = 320; resize(); await flush(); expect(host.querySelector('[role="status"]')!.textContent).toBe("1 / 1");
    content = 1008; resize(); await flush(); await click(host.querySelector('[aria-label="次のページ"]')!);
    await render("second"); await flush(); expect(host.querySelector('[role="status"]')!.textContent).toBe("1 / 3");
  });
  it("reveals a keyboard target on another page", async () => {
    await act(async () => root.render(<ViewportPages><button>後ろの操作</button></ViewportPages>)); await flush();
    const target = host.querySelector(".viewport-pages-flow button")!;
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ left: 688 } as DOMRect);
    await act(async () => target.dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
    expect(host.querySelector('[role="status"]')!.textContent).toBe("3 / 3");
  });
  it("splits oversized rows and restores compact layout when space returns", async () => {
    let height = 200;
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => height);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { height: this.className === "watch-alert" ? 500 : 0, width: 320, left: 0 } as DOMRect;
    });
    await act(async () => root.render(<ViewportPages><article className="watch-alert"><h2>確認差分</h2><p>詳細</p><button>確認</button></article></ViewportPages>)); await flush();
    expect(host.querySelector("article")!.hasAttribute("data-page-split")).toBe(true);
    expect(host.querySelectorAll("article button")).toHaveLength(1);
    height = 600; resize(); await flush();
    expect(host.querySelector("article")!.hasAttribute("data-page-split")).toBe(false);
  });
  it("follows the focused control when async content moves it to another page", async () => {
    await act(async () => root.render(<ViewportPages><a href="/sources">クレジット</a></ViewportPages>)); await flush();
    const target = host.querySelector("a")!; let left = 0;
    vi.spyOn(target, "getBoundingClientRect").mockImplementation(() => ({ left } as DOMRect));
    await act(async () => target.focus());
    left = 688; resize(); await flush();
    expect(document.activeElement).toBe(target);
    expect(host.querySelector('[role="status"]')!.textContent).toBe("3 / 3");
    expect(host.querySelector(".viewport-pages-window")!.scrollLeft).toBe(688);
  });
});

describe("on-demand paged metric help", () => {
  it.each(["OPS", "OBP", "SLG", "K9", "BF", "RISP", "PA", "AB", "IP"])("opens %s with accessible explanation and closes without losing its trigger", async metric => {
    await act(async () => root.render(<MetricLabel metric={metric} />));
    expect(document.querySelector("dialog")).toBeNull();
    const trigger = host.querySelector("button")!; await click(trigger); await flush();
    const dialog = document.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.textContent).toContain(metricHelp(metric)!.description);
    expect(dialog.querySelector('form[method="dialog"]')).not.toBeNull();
    await act(async () => dialog.dispatchEvent(new Event("close")));
    expect(document.querySelector("dialog")).toBeNull(); expect(host.querySelector("button")).toBe(trigger);
  });
});
