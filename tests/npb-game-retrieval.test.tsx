// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PublishedNpbGameSummaryRepository } from "../src/infrastructure/providers/published-npb-game-summary-repository";
import { NpbGameDetailScreen } from "../src/ui/npb-game-detail";
import { PublishedGameSummaryView } from "../src/ui/npb-game-detail";
import index from "../src/data/npb-game-date-index.json";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";

const gameId = "npb:game:49a69ad2efd3bf67d3e5";
const game = { gameId, date: "2026-10-08", gameNumber: 1, scheduledTime: "18:00", status: "final" as const,
  home: { id: "npb:team:tigers", name: "阪神", score: 0 }, away: { id: "npb:team:swallows", name: "ヤクルト", score: 4 },
  completeness: "complete" as const, battingAvailable: true, pitchingAvailable: true, detailAvailable: true };
const day = { schemaVersion: 1 as const, league: "NPB" as const, date: game.date, generatedAt: index.generatedAt,
  coverage: "complete" as const, games: [game] };

it("retains the schedule date on a cold Android deep link without changing Postseason parents", () => {
  const route = `/NPB/games/${gameId}?date=${game.date}`;
  expect(canonicalDeepLink(`baseballnotes:/${route}`)).toContain(`date=${game.date}`);
  expect(parentNativeRoute(route)).toBe(`/NPB/schedule?date=${game.date}`);
  expect(parentNativeRoute(`/NPB/games/${gameId}?date=2026-02-30`)).toBe("/NPB/schedule");
  expect(parentNativeRoute(`/NPB/games/${gameId}?date=${game.date}&competition=postseason&stage=npb_cs_final`)).toBe("/NPB/cs?season=2026&stage=npb_cs_final");
  expect(canonicalDeepLink("baseballnotes://NPB/schedule?date=2026-10-08&private=drop")).toBe("/NPB/schedule?date=2026-10-08");
  expect(canonicalDeepLink("https://tomoya41.github.io/baseball-notes/#/NPB/schedule?date=2026-10-08")).toBe("/NPB/schedule?date=2026-10-08");
  expect(canonicalDeepLink("baseballnotes://NPB/schedule?date=2026-02-30")).toBeNull();
  expect(canonicalDeepLink("baseballnotes://NPB/schedule?date=2026-10-08&competition=postseason")).toBeNull();
  expect(canonicalDeepLink("baseballnotes://NPB/schedule/unknown?date=2026-10-08")).toBeNull();
});

it("keeps router-owned history through Game → team players → player → Back twice", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Android Back</button>; }
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={["/game"]}><Back /><Routes>
      <Route path="/game" element={<PublishedGameSummaryView summary={{ game, generatedAt: day.generatedAt, coverage: day.coverage }} retry={() => undefined} />} />
      <Route path="/NPB/teams/:teamId/players" element={<><h1>球団の選手</h1><Link to="/NPB/players/canonical">選手を開く</Link></>} />
      <Route path="/NPB/players/:id" element={<h1>選手プロフィール</h1>} />
    </Routes></MemoryRouter>));
    await act(async () => [...host.querySelectorAll<HTMLAnchorElement>("a")].find(a => a.textContent?.includes("阪神"))!.click());
    expect(host.textContent).toContain("球団の選手");
    await act(async () => [...host.querySelectorAll<HTMLAnchorElement>("a")].find(a => a.textContent === "選手を開く")!.click());
    expect(host.textContent).toContain("選手プロフィール");
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(host.textContent).toContain("球団の選手");
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(host.textContent).toContain("保存済みの結果 · 更新未確認");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it("locates a legacy cold URL with one dated public payload, without scanning dates or using the DB", async () => {
  const date = vi.fn(async () => day);
  const repository = new PublishedNpbGameSummaryRepository({ date });
  expect(await repository.find(gameId)).toEqual({ game, generatedAt: day.generatedAt, coverage: "complete" });
  expect(date.mock.calls).toHaveLength(1);
  expect(date).toHaveBeenCalledWith(game.date);
  expect(Object.keys(index.dates)).toHaveLength(899);
  expect(new Set(Object.values(index.dates)).size).toBeLessThanOrEqual(200);
});

it("checks ID/date independently and never substitutes another game's score", async () => {
  const date = vi.fn(async () => day);
  const repository = new PublishedNpbGameSummaryRepository({ date }, async () => index);
  await expect(repository.find("npb:game:00000000000000000000")).resolves.toBeNull();
  expect(date).not.toHaveBeenCalled();
  await expect(repository.find(gameId, "2026-02-30")).rejects.toThrow();
  await expect(repository.find(gameId, "2026-10-07")).rejects.toThrow("date mismatch");
  await expect(new PublishedNpbGameSummaryRepository({ date: async () => ({ ...day, games: [] }) }).find(gameId)).resolves.toBeNull();
  await expect(new PublishedNpbGameSummaryRepository({ date: async () => ({ ...day, games: [game, game] }) }).find(gameId)).rejects.toThrow();
  await expect(repository.find("npb:series:123")).rejects.toThrow();
});

it("renders real saved results on API failure, preserves nulls and offers recovery without claiming a Box Score", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  const find = vi.fn().mockRejectedValueOnce(Error("HTTP 503")).mockResolvedValue(null);
  const date = vi.fn(async () => ({ ...day, games: [{ ...game, home: { ...game.home, score: null } }] }));
  const summaryRepository = new PublishedNpbGameSummaryRepository({ date });
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/games/${gameId}?date=${game.date}`]}>
      <Routes><Route path="/NPB/games/:gameId" element={<NpbGameDetailScreen repository={{ find }} summaryRepository={summaryRepository} />} /></Routes>
    </MemoryRouter>));
    expect(host.textContent).toContain("ヤクルト");
    expect(host.textContent).toContain("保存済みの結果 · 更新未確認");
    expect(host.textContent).toContain("個人成績は現在取得できません");
    expect(host.textContent).not.toContain("保存済み打撃成績はありません");
    expect(host.querySelectorAll('[aria-label*="ボックススコア"]')).toHaveLength(0);
    expect(host.querySelector('a[aria-label="日程・結果に戻る"]')?.getAttribute("href")).toBe("#/NPB/schedule?date=2026-10-08");
    expect([...host.querySelectorAll("a")].some(a => a.href.includes("teams/npb%3Ateam%3Atigers/players?season=2026"))).toBe(true);
    expect(host.textContent).toContain("—");
    expect(find).toHaveBeenCalledTimes(1);
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(find).toHaveBeenCalledTimes(2);
    expect(date).toHaveBeenCalledTimes(1); // authoritative 404 is not resurrected from a score index
    expect(host.textContent).toContain("試合が見つかりません");
    expect(host.textContent).not.toContain("ヤクルト");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it("keeps a successful complete/cached API response and player links without consulting summary data", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host), summaryFind = vi.fn();
  const team = { totals: { pa: null, paSource: "unavailable", ab: null, runs: null, hits: null, homeRuns: null } };
  const payload = { ...game, home: { ...game.home, shortName: "阪神", ...team }, away: { ...game.away, shortName: "ヤクルト", ...team },
    batting: { home: [], away: [] }, pitching: { home: [], away: [] } };
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/games/${gameId}`]}><Routes>
      <Route path="/NPB/games/:gameId" element={<NpbGameDetailScreen repository={{ find: vi.fn().mockResolvedValue(payload) }} summaryRepository={{ find: summaryFind }} />} />
    </Routes></MemoryRouter>));
    expect(summaryFind).not.toHaveBeenCalled();
    expect(host.textContent).toContain("ボックススコア");
    expect(host.textContent).not.toContain("現在取得できません");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
