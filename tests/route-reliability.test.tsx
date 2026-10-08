// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary, RouteFocus } from "../src/ui/route-reliability";
import { parentNativeRoute } from "../src/domain/native-navigation";
import { ShareLink } from "../src/ui/product-sharing";
import { portableRoute } from "../src/domain/product-sharing";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const click = async (text: string) => act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === text)!.click());
function Failure(): never { throw Error("screen failure"); }
function Screens() {
  const location = useLocation(), navigate = useNavigate();
  return <><nav><button onClick={() => navigate("/MLB/team-compare")}>別画面</button><button onClick={() => navigate("/MLB/compare")}>比較</button><button onClick={() => navigate("?q=changed")}>条件変更</button></nav>
    <main id="main-content" tabIndex={-1}><RouteFocus /><ShareLink key={location.pathname + location.search} /><RouteErrorBoundary key={`screen:${location.pathname}`}>
      {location.pathname === "/broken" ? <Failure /> : <input aria-label="検索" />}
    </RouteErrorBoundary></main></>;
}
describe("screen isolation and keyboard navigation", () => {
  it("keeps input focus for query-only edits and focuses main for a new screen", async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={["/MLB/search"]}><Screens /></MemoryRouter>));
    const input = container.querySelector("input")!; input.focus(); await click("条件変更");
    expect(document.activeElement).toBe(input); expect(window.scrollTo).not.toHaveBeenCalled();
    await click("別画面"); expect(document.activeElement).toBe(container.querySelector("main")); expect(window.scrollTo).toHaveBeenCalledOnce();
  });
  it("contains rendering failures while keeping navigation available and recovers on a new route", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => root.render(<MemoryRouter initialEntries={["/broken"]}><Screens /></MemoryRouter>));
    expect(container.textContent).toContain("画面を表示できません"); expect(container.querySelector("nav")).not.toBeNull();
    await click("別画面"); expect(container.querySelector("input")).not.toBeNull(); expect(container.textContent).not.toContain("画面を表示できません");
  });
  it("does not accumulate sibling share controls across screen changes", async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={["/MLB/compare"]}><Screens /></MemoryRouter>));
    for (const text of ["別画面", "比較", "別画面", "比較"]) { await click(text); expect(container.querySelectorAll(".share-link")).toHaveLength(1); }
  });
});
describe("direct native load parent context", () => {
  it.each([2020, 2025])("keeps regular-season %s when no browser history is available", season => {
    const id = "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f";
    expect(parentNativeRoute(`/MLB/players/${id}/advanced?season=${season}&role=pitching`)).toBe(`/MLB/players/${id}?season=${season}`);
    expect(parentNativeRoute(`/MLB/compare?season=${season}`)).toBe(`/MLB/search?season=${season}`);
    expect(parentNativeRoute(`/MLB/games/mlb:game:abc?season=${season}`)).toBe(`/MLB/schedule?season=${season}`);
    expect(parentNativeRoute(`/MLB/teams/mlb:team:abc?season=${season}`)).toBe(`/MLB/teams?season=${season}`);
  });
  it("does not leak historical context into NPB or preserve malformed seasons", () => {
    expect(parentNativeRoute("/NPB/teams/npb:team:tigers?season=2025&competition=postseason")).toBe("/NPB/teams");
    expect(parentNativeRoute("/MLB/compare?season=NaN")).toBe("/MLB/search");
  });
  it("omits impossible dates from portable comparison URLs", () => {
    expect(portableRoute("/MLB/compare", "?date=2025-02-30&asOfDate=2024-02-29")).toBe("/MLB/compare?asOfDate=2024-02-29");
  });
});
