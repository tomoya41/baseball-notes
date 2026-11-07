// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PERSONAL_LIBRARY_KEY, PersonalLibrary, type PersonalState } from "../src/application/personal-library";
import { PersonalLibraryProvider } from "../src/ui/library-provider";
import { NpbAnalysisResume } from "../src/ui/personal-library";

const player = "00000000-0000-4000-8000-000000000001";
const now = 1_790_000_000_000;
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

it("opens recent NPB views with their stored comparison and player context without writing preferences", async () => {
  const conditions = new URLSearchParams({ season: "2025", player, role: "pitching", clubYears: "2024,2025", years: "2024,2025", trendMetric: "ERA" });
  const state: PersonalState = { version: 1, collections: [], views: [
    { id: "old", name: "古い条件", league: "NPB", kind: "history", conditions: "season=2024", savedAt: now - 3 },
    { id: "club", name: "球団の変化を調べる", league: "NPB", kind: "history", conditions: conditions.toString(), savedAt: now - 1 },
    { id: "mlb", name: "MLBの条件", league: "MLB", kind: "history", conditions: "season=2025", savedAt: now },
    { id: "age", name: "年末26歳の比較", league: "NPB", kind: "history", conditions: "cohort=ageSeason&age=26&role=pitching&sort1=ERA", savedAt: now - 2 },
  ], activity: [
    { league: "NPB", kind: "players", entityId: player, conditions: "season=2026", visitedAt: now - 1 },
  ] };
  const set = vi.fn(), store = new PersonalLibrary({ get: async key => key === PERSONAL_LIBRARY_KEY ? JSON.stringify(state) : null, set }, () => now);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter><PersonalLibraryProvider store={store}><NpbAnalysisResume /></PersonalLibraryProvider></MemoryRouter>));
    const links = [...host.querySelectorAll<HTMLAnchorElement>("li a")];
    expect(links).toHaveLength(3);
    expect(links[0]!.textContent).toContain("2024年 → 2025年");
    const actual = new URLSearchParams(links[0]!.getAttribute("href")!.split("?")[1]);
    expect(actual.get("clubYears")).toBe("2024,2025");
    expect(actual.get("trendMetric")).toBe("ERA");
    expect(links[1]!.getAttribute("href")).toContain("cohort=ageSeason");
    expect(links[2]!.getAttribute("href")).toBe(`/NPB/players/${player}?season=2026`);
    expect(host.textContent).not.toContain("MLBの条件");
    expect(host.textContent).not.toContain("古い条件");
    expect(set).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
