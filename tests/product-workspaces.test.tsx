// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompareWorkspace, MlbPlayerCompare } from "../src/ui/player-compare";
import { PlayerTrends } from "../src/ui/player-trends";
import { compareBattingKeys } from "../src/domain/player-compare";
vi.mock("../src/ui/product-sharing", () => ({ DisplayExportButton: ({ data }: { data: { coverage: string } }) => <output data-export-coverage>{data.coverage}</output> }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const players = Array.from({ length: 5 }, (_, i) => ({ id: id(i + 1), name: `選手${i + 1}`, batting: true, pitching: true }));
vi.mock("../src/ui/use-mlb-historical", () => ({ useHistoricalDirectory: () => ({ status: "ready", value: { players: [
  { id: "mlb:player:00000000-0000-4000-8000-000000000001", name: "Regular player", positions: ["DH"], seasons: [2025] },
  { id: "mlb:player:00000000-0000-4000-8000-000000000002", name: "Postseason only", positions: ["DH"], seasons: [2025], postseasonOnly: true },
] } }) }));
type Loader = ComponentProps<typeof CompareWorkspace>["loader"];
const loader = vi.fn<Loader>(async id => ({ id, date: "2026-10-02", metrics: { PA: { value: 10 }, H: { value: 0 }, OPS: { value: null } }, notice: null }));
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container); root = createRoot(container); loader.mockClear(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async (path = `/NPB/compare?players=${id(1)},${id(2)}`, read: Loader = loader) => { await act(async () => root.render(<MemoryRouter initialEntries={[path]}><CompareWorkspace league="NPB" players={players} teams={[]} seasons={[2026]} loader={read} /></MemoryRouter>)); };
describe("comparison workspace", () => {
  it("passes archive coverage to CSV even when all displayed metrics are complete", async () => {
    const pid = "mlb:player:00000000-0000-4000-8000-000000000001";
    await act(async () => root.render(<MemoryRouter initialEntries={[`/MLB/compare?season=2025&players=${pid}`]}><CompareWorkspace league="MLB" players={[{ id: pid, name: "保存選手", batting: true, pitching: false }]} teams={[]} seasons={[2025]} loader={async selected => ({ id: selected, date: "2025-09-28", coverage: "partial", notice: "一部データ確認中", metrics: Object.fromEntries(compareBattingKeys.map(k => [k, { value: 1, status: "complete" }])) })} /></MemoryRouter>));
    expect(container.querySelector("[data-export-coverage]")?.textContent).toBe("partial");
  });
  it("does not offer postseason-only identities in a regular-season comparison or BvP selector", async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={["/MLB/compare?season=2025&condition=bvp"]}><MlbPlayerCompare manifest={{ seasons: [{ season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", coverage: "complete" }], teams: [], features: { directBvp: "available" } }} /></MemoryRouter>));
    expect(container.textContent).toContain("Regular player");
    expect(container.querySelector('.compare-search')?.textContent).not.toContain("Postseason only");
    expect(container.querySelector('[value="mlb:player:00000000-0000-4000-8000-000000000002"]')).toBeNull();
  });
  it("drops postseason-only query selections carried into Regular Season by a competition switch", async () => {
    const postOnly = "mlb:player:00000000-0000-4000-8000-000000000002";
    await act(async () => root.render(<MemoryRouter initialEntries={[`/MLB/compare?season=2025&condition=bvp&players=${postOnly}&against=${postOnly}`]}><MlbPlayerCompare manifest={{ seasons: [{ season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", coverage: "complete" }], teams: [], features: { directBvp: "available" } }} /></MemoryRouter>));
    expect(container.querySelectorAll('.compare-selection a')).toHaveLength(0);
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).not.toContain("未収録選手");
    expect(container.textContent).not.toContain("読み込みに失敗");
    expect(container.querySelector<HTMLSelectElement>('.mlb-controls label:last-child select')?.value).toBe("");
  });
  it("shows known zero and null independently with two player columns", async () => { await render(); expect(container.querySelectorAll("table thead th")).toHaveLength(3); const rows = [...container.querySelectorAll("tbody tr")]; expect(rows.find(r => r.querySelector("th")?.textContent === "H")?.textContent).toBe("H00"); expect(rows.find(r => r.querySelector("th")?.textContent?.startsWith("OPS"))?.textContent).toContain("——"); expect(loader).toHaveBeenCalledTimes(2); });
  it("rejects a mixed publication date instead of comparing generations", async () => { await render(undefined, vi.fn(async pid => ({ id: pid, date: pid === id(1) ? "2026-10-01" : "2026-10-02", metrics: {}, notice: null }))); expect(container.textContent).toContain("集計の基準日が揃っていません"); expect(container.querySelector("table")).toBeNull(); });
  it("never falls back to another year", async () => { await render(`/NPB/compare?season=2025&players=${id(1)}`); expect(loader).not.toHaveBeenCalled(); expect(container.textContent).toContain("指定のシーズンは未収録"); });
  it("caps selection at four and exposes labelled removal controls", async () => { await render(`/NPB/compare?players=${players.map(p => p.id).join(",")}`); expect(loader).toHaveBeenCalledTimes(4); expect(container.querySelectorAll(".compare-selection button")).toHaveLength(4); expect(container.querySelector(".compare-search")).toBeNull(); });
  it("removes a selected player while retaining other canonical IDs", async () => { await render(); await act(async () => (container.querySelector('.compare-selection button') as HTMLButtonElement).click()); expect(container.querySelectorAll(".compare-selection button")).toHaveLength(1); expect(container.textContent).toContain("2〜4選手を選んで比較"); });
  it("isolates per-player loading failures without a zero-filled column", async () => { await render(undefined, vi.fn(async pid => { if (pid === id(2)) throw Error("offline"); return { id: pid, date: "2026-10-02", metrics: {}, notice: null }; })); expect(container.textContent).toContain("読み込みに失敗しました"); expect(container.querySelectorAll("table thead th")).toHaveLength(3); });
  it("uses one metric role for all players", async () => { await render(); const pitch = [...container.querySelectorAll("button")].find(b => b.textContent === "投球")!; await act(async () => pitch.click()); expect(loader.mock.calls.at(-1)?.[1]).toMatchObject({ role: "pitching" }); expect(container.querySelector("table")?.textContent).toContain("ERA"); expect(container.querySelector("table")?.textContent).not.toContain("OPS"); });
});
describe("trends UI", () => {
  it("never asserts NPB streaks through partial coverage and provides an accessible chart/table", async () => { await act(async () => root.render(<MemoryRouter><PlayerTrends coverageComplete={false} scope="保存済み試合" pitching={[]} batting={Array.from({ length: 6 }, (_, i) => ({ gameId: `g${i}`, date: `2025-09-0${i + 1}`, gameNumber: 1, pa: 4, ab: 4, hits: 1, doubles: 0, triples: 0, homeRuns: 0, walks: 0, hbp: 0, sacrificeFlies: 0 }))} /></MemoryRouter>)); expect(container.textContent).toContain("連続記録は未確定"); expect(container.querySelector("svg[role=img]")).not.toBeNull(); expect(container.querySelector('[aria-label="打撃の推移表"]')).not.toBeNull(); expect(container.querySelector('.metric-tile__value')?.textContent).toBe("—"); });
});
