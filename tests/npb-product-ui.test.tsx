// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { services as defaults } from "../src/app/services";
import { buildNpbCatalog } from "../src/application/npb-product-payload";
import { npbTeams } from "../src/data/npb-nf3";
import { npbTeamSeasonSchema } from "../src/domain/npb-product-contract";
import { npbLatestStandingsSchema } from "../src/domain/standings";
import { StaticGameSurfaceRepository } from "../src/infrastructure/providers/static-game-surface-repository";
import { StaticHotRepository } from "../src/infrastructure/providers/static-hot-repository";
import { StaticNpbProductRepository } from "../src/infrastructure/providers/static-npb-product-repository";
import { StaticPlayerDirectoryRepository } from "../src/infrastructure/providers/static-player-directory-repository";
import { StaticStandingsRepository } from "../src/infrastructure/providers/static-standings-repository";
import { NpbHome, NpbTeam } from "../src/ui/npb-product";

const id = "00000000-0000-4000-8000-000000000001", teamId = "npb:team:tigers";
const date = "2026-09-29", at = "2026-09-30T00:00:00Z";
const catalog = buildNpbCatalog({ schemaVersion: 2, league: "NPB", effectiveDate: date, generatedAt: at,
  teams: npbTeams.map(t => ({ id: t.id, name: t.name, shortName: t.short })),
  players: [{ playerId: id, displayName: "保存済み選手", teamId, position: null, playerType: null,
    birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
    battingAvailable: true, pitchingAvailable: false, recentAvailable: true }] },
  { observedAt: at, effectiveDate: date, players: [] });
const season = npbTeamSeasonSchema.parse({ schemaVersion: 1, league: "NPB", season: 2026,
  competition: "regular", effectiveDate: date, generatedAt: at, period: { from: "2026-03-27", to: date },
  scope: "stored_final_games", coverage: { status: "partial", summary: {
    dates: 1, complete: 0, noGames: 0, partial: 1, unknown: 0, failed: 0 } },
  teams: [{ teamId, G: 1, W: 0, L: 1, T: 0, runsFor: 0, runsAgainst: 1, scoreStatus: "complete",
    gamesWithBattingFacts: 1, gamesWithPitchingFacts: 1, observedHomeVenues: [], batting: {}, pitching: {} }] });
const recent = (effectiveDate = date) => ({ schemaVersion: 1, league: "NPB", effectiveDate, generatedAt: at, games: [] });
const unavailable: typeof fetch = async () => new Response(null, { status: 503 });
const homeServices = (request: typeof fetch) => ({ ...defaults,
  gameSurface: new StaticGameSurfaceRepository("https://example.test/", request),
  directory: new StaticPlayerDirectoryRepository("https://example.test/", unavailable),
  hot: new StaticHotRepository("https://example.test/", unavailable) });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-01T00:00:00+09:00"));
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => { root.unmount(); }); container.remove();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
async function mount(child: ReactNode, path = "/NPB/home") {
  await act(async () => { root.render(<MemoryRouter initialEntries={[path]}>{child}</MemoryRouter>); });
}
const context = () => container.querySelector(".competition-header .eyebrow")?.textContent;
async function mountTeam(request: typeof fetch) {
  const product = new StaticNpbProductRepository("https://example.test/", request);
  await mount(<Routes><Route path="/NPB/teams/:teamId" element={<NpbTeam services={{ ...defaults, product }} />} /></Routes>, `/NPB/teams/${teamId}`);
}

describe("NPB Home saved Season context", () => {
  it("stays neutral until saved data loads, including at the device's year rollover", async () => {
    const response = deferred<Response>(), request = vi.fn<typeof fetch>(() => response.promise);
    await mount(<NpbHome services={homeServices(request)} favorites={[]} toggle={() => {}} saving={false} />);
    expect(context()).toBe("公式戦");
    await act(async () => { response.resolve(Response.json(recent())); });
    expect(context()).toBe("2026年 · 公式戦");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("uses effectiveDate even for an empty saved recent payload", async () => {
    await mount(<NpbHome services={homeServices(async () => Response.json(recent("2025-12-31")))} favorites={[]} toggle={() => {}} saving={false} />);
    expect(context()).toBe("2025年 · 公式戦");
  });
  it.each(["HTTP failure", "invalid effectiveDate"])("remains neutral after %s, without a clock fallback", async failure => {
    const request: typeof fetch = failure === "HTTP failure" ? unavailable : async () => Response.json(recent("2026-02-30"));
    await mount(<NpbHome services={homeServices(request)} favorites={[]} toggle={() => {}} saving={false} />);
    expect(context()).toBe("公式戦");
    expect(container.textContent).toContain("試合結果を読み込めません");
  });
  it("updates context from the loaded standings when changing Home mode", async () => {
    const response = deferred<Response>(), request = vi.fn<typeof fetch>(() => response.promise);
    const services = { ...homeServices(async () => Response.json(recent())),
      standings: new StaticStandingsRepository("https://example.test/", request) };
    await mount(<NpbHome services={services} favorites={[]} toggle={() => {}} saving={false} />);
    expect(context()).toBe("2026年 · 公式戦");
    const button = [...container.querySelectorAll("button")].find(b => b.textContent === "順位表")!;
    await act(async () => { button.click(); });
    expect(context()).toBe("公式戦");
    const throughDate = "2025-10-01";
    const standings = npbLatestStandingsSchema.parse({ schemaVersion: 1, league: "NPB", throughDate,
      effectiveDate: throughDate, generatedAt: at, collectedAt: at, sourceUpdatedAt: null, sourceKey: "nf3", attribution: "Fixture",
      teams: Object.fromEntries(npbTeams.map(t => [t.id, { name: t.name, short: t.short }])),
      standings: npbTeams.map((t, i) => ({ date: throughDate, season: 2025, league: "NPB", competitionGroup: t.group,
        teamId: t.id, rank: i % 6 + 1, wins: 1, losses: 1, ties: 0, gamesPlayed: 2, pct: 0.5,
        gamesBehindLeader: 0, streak: 0, sourceKey: "nf3", collectedAt: at, calculatedAt: at })) });
    await act(async () => { response.resolve(Response.json(standings)); });
    expect(context()).toBe("2025年 · 公式戦"); expect(request).toHaveBeenCalledTimes(1);
    const follow = [...container.querySelectorAll("button")].find(b => b.textContent === "フォロー")!;
    await act(async () => { follow.click(); });
    expect(context()).toBe("公式戦");
  });
});

describe("NPB Team independent Season loading", () => {
  it("keeps the Catalog and roster visible while Season is pending", async () => {
    const response = deferred<Response>();
    await mountTeam(async url => String(url).includes("catalog/") ? Response.json(catalog) : response.promise);
    expect(container.querySelector("h1")?.textContent).toBe("阪神タイガース");
    expect(container.querySelector(`a[href='/NPB/players/${id}']`)?.textContent).toContain("保存済み選手");
    expect(container.textContent).toContain("シーズン成績");
    expect(container.querySelector('[aria-label="読み込み中"]')).not.toBeNull();
    await act(async () => { response.resolve(Response.json(season)); });
    expect(container.textContent).toContain("2026シーズン");
  });
  it.each(["missing", "temporary HTTP error", "invalid", "wrong Season"])("retains team and players but announces %s Season data", async failure => {
    const request = vi.fn<typeof fetch>(async url => {
      if (String(url).includes("catalog/")) return Response.json(catalog);
      if (failure === "missing") return new Response(null, { status: 404 });
      if (failure === "temporary HTTP error") return unavailable(url);
      return Response.json(failure === "invalid" ? { schemaVersion: 999 } : { ...season, season: 2025 });
    });
    await mountTeam(request);
    expect(container.querySelector("h1")?.textContent).toBe("阪神タイガース");
    expect(container.querySelector(`a[href='/NPB/players/${id}']`)?.textContent).toContain("保存済み選手");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("シーズン成績を読み込めません");
    expect(container.querySelector(".metric-grid")).toBeNull();
    expect(request.mock.calls[1]?.[0]).toContain("teams/season/2026/latest.json");
  });
  it("preserves the normal saved Season metrics, zero values and partial Coverage notice", async () => {
    await mountTeam(async url => Response.json(String(url).includes("catalog/") ? catalog : season));
    expect(container.textContent).toContain("2026シーズン"); expect(container.textContent).toContain("一部データ確認中");
    expect([...container.querySelectorAll(".metric-tile__value")].map(e => e.textContent)).toEqual(["1", "0", "1", "0", "0", "1"]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it("explicitly shows unavailable Season stats when a valid payload has no matching team", async () => {
    await mountTeam(async url => Response.json(String(url).includes("catalog/") ? catalog : { ...season, teams: [] }));
    expect(container.textContent).toContain("保存済みのシーズン成績はありません");
    expect(container.textContent).toContain("保存済み選手");
  });
  it("keeps Catalog failure distinct and never requests Season without it", async () => {
    const request = vi.fn(unavailable); await mountTeam(request);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("球団情報を読み込めません");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
