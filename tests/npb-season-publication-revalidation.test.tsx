// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readNpbExplorerSeason } from "../src/application/explorer-readers";
import type { NpbSeasonPayload } from "../src/application/npb-season-payload";
import type { Services } from "../src/app/services";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import type { PlayerRecentResponse } from "../src/domain/player-recent";
import { NpbPlayer } from "../src/ui/npb-player";

vi.mock("../src/application/explorer-readers", () => ({ readNpbExplorerSeason: vi.fn() }));

const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const identity = { playerId, displayName: "確認済み選手", teamId: "npb:team:tigers" };
const period = { from: "2026-03-27", to: "2026-10-08" };
const summary = { dates: 196, complete: 166, partial: 5, failed: 0, unknown: 0, noGames: 25 };
const coverage = { status: "partial", summary } as const;
const metric = (value: number) => ({ value, status: "complete" as const, observedFacts: 1, factCount: 1 });
const stats = (hr: number) => ({ HR: metric(hr), OPS: metric(0.925), AVG: metric(0.3), PA: metric(35) });
const earlier: NpbPlayerDirectory = { schemaVersion: 2, league: "NPB", effectiveDate: "2026-10-11",
  generatedAt: "2026-10-12T00:00:00Z", teams: [{ id: identity.teamId, name: "阪神タイガース", shortName: "阪神" }],
  players: [{ ...identity, position: "OF", playerType: "fielder", birthDate: null, birthPlace: null,
    nationality: null, bats: null, throws: null, battingAvailable: true, pitchingAvailable: false, recentAvailable: true }] };
const later = { ...earlier, effectiveDate: "2026-10-12", generatedAt: "2026-10-13T00:00:00Z" };
const api: PlayerRecentResponse = { player: { id: playerId, name: identity.displayName, teamId: identity.teamId, teamName: "阪神" },
  period: "season", asOfDate: earlier.effectiveDate, batting: { ...period, playerId, games: 1, factCount: 1,
    dataStatus: "complete", coverage: { ...period, ...coverage, calendar: [], finalGameDates: [], completeGameDates: [],
      noGameDates: [], partialDates: [], unknownDates: [] }, calculatedAt: "2026-10-14T00:00:00Z", metrics: stats(3) }, pitching: null };
const published = { schemaVersion: 1, league: "NPB", season: 2026, effectiveDate: later.effectiveDate,
  generatedAt: "2026-10-12T13:00:00Z", period, coverage,
  players: [{ ...identity, batting: { metrics: stats(4), factCount: 1 }, pitching: null }] } as unknown as NpbSeasonPayload;

beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.mocked(readNpbExplorerSeason).mockReset(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("only switches to a later verified season and never re-polls the results API", async () => {
  let time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const resume = () => act(async () => {
    time += 31_000;
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const findLatestNpb = vi.fn().mockResolvedValueOnce(earlier).mockResolvedValue(later);
  const recent = vi.fn(async (_id: string, key: string) => key === "season" ? api : null);
  const deps = { directory: { findLatestNpb }, product: { player: vi.fn().mockResolvedValue(null) },
    recent: { find: recent }, gameLog: { find: vi.fn().mockResolvedValue(null) } } as unknown as Services;
  const host = document.createElement("div"), root = createRoot(host);
  const route = `/NPB/players/${playerId}`;
  function Address() { return <output>{useLocation().pathname}</output>; }
  document.body.append(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[route]}><Routes><Route path="/NPB/players/:playerId"
      element={<NpbPlayer services={deps} favorites={[]} saving={false} toggle={() => {}}/>}/></Routes><Address/></MemoryRouter>));
    const homeRuns = () => host.querySelectorAll(".headline-stats dd")[1]?.textContent;
    expect(homeRuns()).toBe("3");
    expect(host.querySelector(".headline-stats-context")?.textContent).toContain("35打席");
    expect(host.querySelector(".headline-stats dl")?.textContent).toContain("本塁打");
    expect(readNpbExplorerSeason).not.toHaveBeenCalled();

    vi.mocked(readNpbExplorerSeason).mockResolvedValueOnce({ ...published, effectiveDate: earlier.effectiveDate });
    await resume();
    expect(homeRuns()).toBe("3");

    vi.mocked(readNpbExplorerSeason).mockResolvedValueOnce(published);
    await resume();
    expect(homeRuns()).toBe("4");
    expect(host.querySelector(".headline-stats")?.textContent).toContain("2026-10-08まで");
    expect(host.querySelector<HTMLTimeElement>(".player-snapshot time")?.dateTime).toBe(later.effectiveDate);
    expect(host.querySelector(".published-player-stats")?.textContent).toContain("一部未収集");
    expect(host.querySelector("output")?.textContent).toBe(route);

    vi.mocked(readNpbExplorerSeason).mockRejectedValueOnce(Error("HTTP 503"));
    await resume();
    expect(homeRuns()).toBe("4");
    expect(host.textContent).toContain("確認済みの成績を表示しています");
    expect(recent.mock.calls.filter(([, key]) => key === "season")).toHaveLength(1);
    expect(findLatestNpb).toHaveBeenCalledTimes(4);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
