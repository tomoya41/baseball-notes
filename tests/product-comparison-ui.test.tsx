// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalLibrary, PERSONAL_LIBRARY_KEY } from "../src/application/personal-library";

import { PersonalLibraryProvider } from "../src/ui/library-provider";
import { CollectionDashboard } from "../src/ui/collection-dashboard";
import { MlbTeamCompare, SeasonCompare } from "../src/ui/team-season-compare";
import { services } from "../src/app/services";
import { HistoricalCompetitionContext } from "../src/ui/historical-competition-context";
const mocks = vi.hoisted(() => ({ historical: vi.fn(), season: vi.fn(), recent: vi.fn(), npbTeam: vi.fn(), mlbTeam: vi.fn() }));
vi.mock("../src/app/historical-products", () => ({ readHistoricalProduct: mocks.historical }));
vi.mock("../src/application/explorer-readers", () => ({ readNpbExplorerSeason: mocks.season, readNpbRecentExplorer: mocks.recent }));
vi.mock("../src/application/product-comparison", async importOriginal => ({ ...await importOriginal<typeof import("../src/application/product-comparison")>(), readNpbTeamComparison: mocks.npbTeam, readMlbTeamComparison: mocks.mlbTeam }));
vi.mock("../src/ui/use-mlb-historical", () => ({ useHistoricalStatic: () => ({ value: { players: [] }, status: "ready" }) }));
let div: HTMLDivElement, root: Root, store: PersonalLibrary, saved: Map<string, string>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, player = `mlb:player:${uuid(1)}`, team = `mlb:team:${uuid(2)}`;
const manifest = { teams: [{ id: team, name: "球団" }], seasons: [2020, 2021, 2025].map(season => ({ season, firstDate: `${season}-04-01`, lastDate: `${season}-09-28`, coverage: "complete" })) };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); Object.values(mocks).forEach(m => m.mockReset());
  saved = new Map(); let n = 0; store = new PersonalLibrary({ get: async k => saved.get(k) ?? null, set: async (k, v) => { saved.set(k, v); } }, () => Date.now(), () => `local-${++n}`);
  div = document.createElement("div"); document.body.append(div); root = createRoot(div);
  vi.spyOn(services.directory, "findLatestNpb").mockResolvedValue({ effectiveDate: "2026-10-03", players: Array.from({ length: 13 }, (_, i) => ({ playerId: uuid(i + 1), displayName: `選手${i}` })) } as never);
  vi.spyOn(services.product, "catalog").mockResolvedValue({ players: [], teams: [] } as never);
});
afterEach(async () => { await act(async () => root.unmount()); div.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function mount(child: ReactNode, path: string) { await act(async () => root.render(<MemoryRouter key={path} initialEntries={[path]}><PersonalLibraryProvider store={store}>{child}</PersonalLibraryProvider></MemoryRouter>)); }
const metric = (v: number) => ({ value: v, status: "complete" });
describe("comparison and collection scope", () => {
  it("loads Player seasons once and shows true prior-year delta, missing years stay unavailable", async () => {
    mocks.historical.mockResolvedValue({ player: { id: player }, seasonTotals: { "2020": { batting: { OPS: metric(.8), PA: metric(100) } }, "2021": { batting: { OPS: metric(.9), PA: metric(200) } } } });
    await mount(<SeasonCompare league="MLB" manifest={manifest} />, `/MLB/season-compare?entity=${encodeURIComponent(player)}&years=2020,2021,2025`);
    expect(mocks.historical).toHaveBeenCalledOnce(); expect(div.textContent).toContain("+0.100"); expect(div.textContent).toContain("この年度・出場形態の記録なし"); expect(div.textContent).toContain("Career・通算成績ではありません");
    expect([...div.querySelectorAll('a')].find(a => a.textContent?.includes("2021年の保存済み成績"))!.getAttribute("href")).toContain("season=2021");
  });
  it("rejects MLB Current and NPB fake historical before reading a payload", async () => {
    await mount(<SeasonCompare league="MLB" manifest={manifest} />, `/MLB/season-compare?entity=${encodeURIComponent(player)}&years=2026`); expect(div.textContent).toContain("未収録"); expect(mocks.historical).not.toHaveBeenCalled();
    await mount(<SeasonCompare league="NPB" services={services} />, `/NPB/season-compare?entity=${uuid(1)}&years=2025`); expect(mocks.season).not.toHaveBeenCalled();
  });
  it("unchecking all years does not silently reselect six seasons", async () => {
    mocks.historical.mockResolvedValue({ player: { id: player }, seasonTotals: {} }); await mount(<SeasonCompare league="MLB" manifest={manifest} />, `/MLB/season-compare?entity=${encodeURIComponent(player)}&years=2025`);
    await act(async () => [...div.querySelectorAll('input[type=checkbox]')].find(el => (el as HTMLInputElement).checked)!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(div.querySelector('input:checked')).toBeNull(); expect(div.textContent).toContain("未収録");
  });
  it("keeps Postseason Team comparisons in the selected competition", async () => {
    mocks.mlbTeam.mockResolvedValue({ id: team, name: "球団", season: 2025, date: "2025-09-28", coverage: "complete", metrics: { G: metric(3) } });
    await mount(<HistoricalCompetitionContext.Provider value="postseason"><MlbTeamCompare manifest={manifest} /></HistoricalCompetitionContext.Provider>, `/MLB/team-compare?teams=${encodeURIComponent(team)}&season=2025&competition=postseason&view=14`);
    expect(mocks.mlbTeam).toHaveBeenCalledWith(team, "球団", 2025, "postseason", "14"); expect(div.textContent).toContain("POSTSEASON");
  });
  it("uses one NPB bulk projection for a bounded 12-player dashboard and preserves local Favorites", async () => {
    const c = (await store.createCollection("候補")).collections[0]!; for (let n = 1; n <= 13; n++) await store.setPlayer(c.id, { league: "NPB", playerId: uuid(n) }, true);
    mocks.season.mockResolvedValue({ effectiveDate: "2026-10-03", coverage: { status: "partial" }, players: [{ playerId: uuid(1), batting: { metrics: { PA: metric(100), HR: metric(2), OPS: metric(.8) } } }] });
    const bytes = saved.get(PERSONAL_LIBRARY_KEY); await mount(<Routes><Route path="/NPB/library/collections/:collectionId" element={<CollectionDashboard league="NPB" services={services} favorites={[{ league: "NPB", kind: "player", entityId: uuid(1) } as never]} />} /></Routes>, `/NPB/library/collections/${c.id}`);
    expect(div.querySelectorAll('.collection-watch-row')).toHaveLength(12); expect(mocks.season).toHaveBeenCalledOnce(); expect(mocks.historical).not.toHaveBeenCalled(); expect(saved.get(PERSONAL_LIBRARY_KEY)).toBe(bytes); expect(div.textContent).toContain("★ 選手0"); expect(div.textContent).toContain("一部未確認");
  });
  it("retains collection and shell when cached payloads cannot be read", async () => {
    const c = (await store.createCollection("保存")).collections[0]!; await store.setPlayer(c.id, { league: "NPB", playerId: uuid(1) }, true); mocks.season.mockRejectedValue(Error("offline"));
    await mount(<Routes><Route path="/NPB/library/collections/:collectionId" element={<CollectionDashboard league="NPB" services={services} favorites={[]} />} /></Routes>, `/NPB/library/collections/${c.id}`);
    expect(div.textContent).toContain("保存した選手は維持"); expect((await store.read()).collections[0]!.players).toHaveLength(1);
  });
  it("carries the current Recent window into a Collection comparison", async () => {
    const c = (await store.createCollection("14日")).collections[0]!; for (const n of [1, 2]) await store.setPlayer(c.id, { league: "NPB", playerId: uuid(n) }, true);
    mocks.recent.mockResolvedValue({ effectiveDate: "2026-10-03", coverage: { status: "partial" }, players: [] });
    await mount(<Routes><Route path="/NPB/library/collections/:collectionId" element={<CollectionDashboard league="NPB" services={services} favorites={[]} />} /></Routes>, `/NPB/library/collections/${c.id}?period=14`);
    for (const el of div.querySelectorAll('input[type=checkbox]')) await act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const link = [...div.querySelectorAll('a')].find(a => a.textContent?.includes("2人を比較"))!; expect(link.getAttribute("href")).toContain("condition=14d"); expect(link.getAttribute("href")).toContain("season=2026");
  });
});
