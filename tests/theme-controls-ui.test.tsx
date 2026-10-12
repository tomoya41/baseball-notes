// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThemeSettings } from "../src/ui/design-system";
const flags = vi.hoisted(() => ({ quota: false }));
vi.mock("../src/app/appearance", async original => ({ ...(await original<object>()), setAppearance: vi.fn(async (choice: string) => { document.documentElement.dataset.theme = choice; if (flags.quota) throw Error("quota"); }) }));
let element: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); flags.quota = false; document.documentElement.dataset.theme = "system"; element = document.createElement("div"); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); delete document.documentElement.dataset.theme; vi.unstubAllGlobals(); });
const darkButtons = () => [...element.querySelectorAll("button")].filter(button => button.textContent === "ダーク");
it("synchronizes a header dialog and a mounted My control", async () => { await act(async () => root.render(<><ThemeSettings /><ThemeSettings /></>)); await act(async () => darkButtons()[0]!.click()); expect(document.documentElement.dataset.theme).toBe("dark"); expect(darkButtons().map(button => button.getAttribute("aria-pressed"))).toEqual(["true", "true"]); });
it("keeps the applied session theme synchronized even if storage quota fails", async () => { flags.quota = true; await act(async () => root.render(<><ThemeSettings /><ThemeSettings /></>)); await act(async () => darkButtons()[0]!.click()); expect(darkButtons().map(button => button.getAttribute("aria-pressed"))).toEqual(["true", "true"]); expect(element.textContent).toContain("今回の起動中だけ"); await act(async () => root.render(<><ThemeSettings /><ThemeSettings /><ThemeSettings /></>)); expect(darkButtons().map(button => button.getAttribute("aria-pressed"))).toEqual(["true", "true", "true"]); });
