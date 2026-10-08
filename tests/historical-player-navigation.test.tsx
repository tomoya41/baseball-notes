// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MlbHistoricalPlayer } from "../src/ui/mlb-historical";

const id = "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f";
vi.mock("../src/ui/use-mlb-historical", () => ({
  useHistoricalStatic: () => ({ status: "ready", retry: () => {}, value: {
    player: { id: "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f", name: "大谷翔平", seasons: [2020, 2025], positions: [], teamIds: [], bats: null, throws: null },
    batting: [], pitching: [], seasonTotals: {}, collectedRange: "2020–2025", collectedRangeTotals: { batting: null, pitching: null },
  } }),
}));
const manifest = { schemaVersion: 1 as const, league: "MLB" as const, current2026: "unavailable" as const, teams: [],
  seasons: [2020, 2025].map(season => ({ season, firstDate: `${season}-07-01`, lastDate: `${season}-10-01`, games: 0, coverage: "complete" as const, playerCount: 1 })) };
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
afterEach(() => { vi.unstubAllGlobals(); });
describe("historical player navigation context", () => {
  it.each(["advanced", "obsolete"])("keeps the selected year and as-of date through %s fallback", async section => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const element = document.createElement("div"); document.body.append(element);
    const root = createRoot(element);
    try {
      await act(async () => root.render(<MemoryRouter initialEntries={[`/MLB/players/${encodeURIComponent(id)}/${section}?season=2020&asOfDate=2020-08-01`]}>
        <Location /><Routes><Route path="/MLB/players/:playerId/:section?" element={<MlbHistoricalPlayer manifest={manifest} favorites={[]} saving={false} toggle={() => {}} />} /></Routes>
      </MemoryRouter>));
      expect(element.querySelector("output")?.textContent).toBe(`/MLB/players/${encodeURIComponent(id)}${section === "advanced" ? "/analysis" : ""}?season=2020&asOfDate=2020-08-01`);
      expect(element.querySelector("a.back-link")?.getAttribute("href")).toBe("/MLB/search?season=2020");
    } finally { await act(async () => root.unmount()); element.remove(); }
  });
});
