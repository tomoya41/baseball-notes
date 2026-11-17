// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PublishedNpbGameSummaryRepository } from "../src/infrastructure/providers/published-npb-game-summary-repository";
import { NpbGameDetailScreen } from "../src/ui/npb-game-detail";
import { PublishedGameSummaryView } from "../src/ui/npb-game-detail";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import { readNpbGameDateIndex } from "../src/application/npb-game-date-index-reader";
import pin from "../src/data/npb-game-date-index-release.json";
import { createHash, webcrypto } from "node:crypto";
import { createPublicFetch } from "../src/infrastructure/public-response-cache";
import { mvpFixture } from "./fixtures/daily-mvp";
import { matchesPublishedFinalGame, readPublishedFinalGame, type DeferGameAssetCache } from "../src/application/game-surface";
import { services } from "../src/app/services";
import { StaticGameSurfaceRepository } from "../src/infrastructure/providers/static-game-surface-repository";
import { HttpNpbGameDetailRepository } from "../src/infrastructure/providers/http-npb-game-detail-repository";

const gameId = "npb:game:49a69ad2efd3bf67d3e5";
const index = {schemaVersion:1,league:"NPB",competition:"regular",effectiveDate:"2026-10-12",generatedAt:"2026-10-14T15:05:03.165Z",dates:{[gameId]:"2026-10-08"}};
const game = { gameId, date: "2026-10-08", gameNumber: 1, scheduledTime: "18:00", status: "final" as const,
  home: { id: "npb:team:tigers", name: "阪神", score: 0 }, away: { id: "npb:team:swallows", name: "ヤクルト", score: 4 },
  completeness: "complete" as const, battingAvailable: true, pitchingAvailable: true, detailAvailable: true };
const day = { schemaVersion: 1 as const, league: "NPB" as const, date: game.date, generatedAt: index.generatedAt,
  coverage: "complete" as const, games: [game] };

it("admits only the pinned immutable date lookup and caches only after hash/schema/snapshot checks", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const text=JSON.stringify(index), release={...pin,games:1,bytes:Buffer.byteLength(text),sha256:createHash("sha256").update(text).digest("hex")};
  const put=vi.fn(), store={get:vi.fn(async()=>undefined),put,remove:vi.fn(async()=>undefined)};
  try {
    const request=vi.fn<typeof fetch>(async()=>new Response(text));
    expect(await readNpbGameDateIndex("https://example.test/",createPublicFetch(store,request,()=>true),release)).toEqual(index);
    expect(put).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]![0])).toContain(`games/index/${release.sha256}/dates.json`);
    put.mockClear();
    const changed=text.replace("2026-10-08","2026-10-09");
    await expect(readNpbGameDateIndex("https://example.test/",createPublicFetch(store,async()=>new Response(changed),()=>true),release)).rejects.toThrow("hash mismatch");
    expect(put).not.toHaveBeenCalled();
    await expect(readNpbGameDateIndex("https://example.test/",async()=>new Response(text),{...release,games:2})).rejects.toThrow("Unadmitted");
    await expect(readNpbGameDateIndex("https://example.test/",async()=>new Response("{}"),release)).rejects.toThrow("size mismatch");
  } finally { vi.unstubAllGlobals(); }
});

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
  const repository = new PublishedNpbGameSummaryRepository({ date }, async () => index);
  expect(await repository.find(gameId)).toEqual({ game, generatedAt: day.generatedAt, coverage: "complete" });
  expect(date.mock.calls).toHaveLength(1);
  expect(date).toHaveBeenCalledWith(game.date);
});

it("checks ID/date independently and never substitutes another game's score", async () => {
  const date = vi.fn(async () => day);
  const repository = new PublishedNpbGameSummaryRepository({ date }, async () => index);
  await expect(repository.find("npb:game:00000000000000000000")).resolves.toBeNull();
  expect(date).not.toHaveBeenCalled();
  await expect(repository.find(gameId, "2026-02-30")).rejects.toThrow();
  await expect(repository.find(gameId, "2026-10-07")).rejects.toThrow("date mismatch");
  await expect(new PublishedNpbGameSummaryRepository({ date: async () => ({ ...day, games: [] }) }, async () => index).find(gameId)).resolves.toBeNull();
  await expect(new PublishedNpbGameSummaryRepository({ date: async () => ({ ...day, games: [game, game] }) }, async () => index).find(gameId)).rejects.toThrow();
  await expect(repository.find("npb:series:123")).rejects.toThrow();
});

it("saves no assets when the published result belongs to another game or has no confirmed score", async () => {
  const manifest = { schemaVersion: 1 as const, league: "NPB" as const, from: game.date, to: game.date,
    effectiveDate: game.date, generatedAt: day.generatedAt };
  const remember = vi.fn(async () => {});
  const reader = {
    manifest: async (defer?: DeferGameAssetCache) => { defer?.(remember); return manifest; },
    date: async (_date: string, _generation?: string, defer?: DeferGameAssetCache) => {
      defer?.(remember);
      return day;
    },
  };
  await expect(readPublishedFinalGame(reader, { ...game, gameNumber: 2 })).rejects.toThrow("identity mismatch");
  await expect(readPublishedFinalGame(reader, { ...game, away: game.home, home: game.away })).rejects.toThrow("identity mismatch");
  await expect(readPublishedFinalGame({ ...reader, date: async () => ({ ...day,
    games: [{ ...game, away: { ...game.away, score: null } }],
  }) }, game)).resolves.toBeNull();
  expect(remember).not.toHaveBeenCalled();
  await expect(readPublishedFinalGame(reader, game)).resolves.toEqual({ game, generatedAt: day.generatedAt, coverage: day.coverage });
  expect(remember).toHaveBeenCalledTimes(2);
});

it("does not cache a queried game detail that conflicts with the confirmed score", async () => {
  const { game: detail, index } = mvpFixture();
  const published = index.games[0]!;
  const stale = { ...detail, away: { ...detail.away, score: 0 } };
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(stale)).mockResolvedValueOnce(Response.json(detail));
  const put = vi.fn();
  const repository = new HttpNpbGameDetailRepository("https://example.test/", createPublicFetch({
    get: async () => undefined, put, remove: async () => {},
  }, request, () => true));
  const matches = (value: typeof detail) => matchesPublishedFinalGame(published, value);
  expect(await repository.find(detail.gameId, matches)).toEqual(stale);
  expect(put).not.toHaveBeenCalled();
  expect(await repository.find(detail.gameId, matches)).toEqual(detail);
  expect(put).toHaveBeenCalledTimes(1);
});

it("advances an open pregame view on matching public results, preserving them through stale detail retries", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const host = document.createElement("div"), root = createRoot(host);
  const payload = mvpFixture().game;
  const final = { ...payload, gameId, date: game.date, home: { ...payload.home, ...game.home }, away: { ...payload.away, ...game.away } };
  const scheduled = { ...final, status: "scheduled" as const, completeness: null,
    home: { ...final.home, score: null }, away: { ...final.away, score: null }, batting: { away: [], home: [] }, pitching: { away: [], home: [] } };
  const find = vi.fn().mockResolvedValueOnce(scheduled).mockResolvedValueOnce(scheduled)
    .mockResolvedValueOnce({ ...final, home: { ...final.home, score: 1 } }).mockRejectedValueOnce(Error("HTTP 503")).mockResolvedValue(final);
  const summary = vi.fn();
  const manifest = { schemaVersion: 1 as const, league: "NPB" as const, from: game.date, to: game.date,
    effectiveDate: game.date, generatedAt: day.generatedAt };
  const gameSurface = new StaticGameSurfaceRepository("https://example.test/");
  const before = { ...manifest, effectiveDate: "2026-10-07" };
  const read = vi.spyOn(gameSurface, "manifest").mockResolvedValueOnce(before).mockResolvedValueOnce(before).mockResolvedValue(manifest);
  const date = vi.spyOn(gameSurface, "date").mockResolvedValue({ ...day, generatedAt: "2026-10-13T15:05:03.165Z" });
  const refresh = () => act(async () => { time += 31_000; window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
  const score = () => host.querySelector(".score-hero")?.getAttribute("aria-label");
  const retry = () => act(async () => host.querySelector<HTMLButtonElement>(".game-detail button.button--secondary")!.click());
  const query = `date=${game.date}&team=npb%3Ateam%3Atigers&boxSide=home`;
  try {
    const deps = { ...services, gameSurface };
    vi.spyOn(deps.product, "teamSeason").mockRejectedValue(Error("Team season unavailable"));
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/games/${gameId}?${query}`]}><Routes>
      <Route path="/NPB/games/:gameId" element={<NpbGameDetailScreen repository={{ find }} services={deps} summaryRepository={{ find: summary }} />} />
    </Routes></MemoryRouter>));
    expect(score()).toContain("開始前");
    expect(read).toHaveBeenCalledTimes(2); // preview and initial result check
    expect(date).not.toHaveBeenCalled();
    await refresh();
    expect(date).toHaveBeenCalledTimes(1);
    expect(score()).toContain("開始前");
    expect(host.textContent).toContain("試合結果の更新を確認できませんでした");
    expect(host.textContent).not.toContain("公開結果を反映しました");

    date.mockResolvedValue(day);
    await refresh();
    expect(score()).toBe("ヤクルト 4、阪神 0、試合終了");
    expect(host.textContent).toContain("個人成績は未確認です");
    expect(host.querySelectorAll('[aria-label*="ボックススコア"]')).toHaveLength(0);
    expect(host.querySelector('a[aria-label="日程・結果に戻る"]')?.getAttribute("href"))
      .toBe("#/NPB/schedule?date=2026-10-08&team=npb%3Ateam%3Atigers");
    expect(find).toHaveBeenCalledTimes(1);

    await retry();
    expect(score()).toBe("ヤクルト 4、阪神 0、試合終了");
    await retry();
    expect(score()).toBe("ヤクルト 4、阪神 0、試合終了");
    expect(host.textContent).not.toContain("架空打者");
    await retry();
    expect(score()).toBe("ヤクルト 4、阪神 0、試合終了");
    expect(summary).not.toHaveBeenCalled();
    await retry();
    expect(score()).toContain("試合終了");
    expect(host.textContent).toContain("架空打者");
    expect(host.textContent).not.toContain("個人成績は未確認です");
    await refresh();
    expect(find).toHaveBeenCalledTimes(5);
    expect(read).toHaveBeenCalledTimes(4);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); }
});

it("renders real saved results on API failure, preserves nulls and offers recovery without claiming a Box Score", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  const find = vi.fn().mockRejectedValueOnce(Error("HTTP 503")).mockResolvedValue(null);
  const date = vi.fn(async () => ({ ...day, games: [{ ...game, home: { ...game.home, score: null } }] }));
  const summaryRepository = new PublishedNpbGameSummaryRepository({ date }, async () => index);
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

it("never shows the previous game's box score or MVP while another game loads", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  const first = mvpFixture().game;
  const nextId = "npb:game:bbbbbbbbbbbbbbbbbbbb";
  let failNext!: (reason: Error) => void;
  const next = new Promise<null>((_resolve, reject) => { failNext = reject; });
  const find = vi.fn((id: string) => id === first.gameId ? Promise.resolve(first) : next);
  const summaryFind = vi.fn();
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/games/${first.gameId}`]}>
      <nav><Link to={`/NPB/games/${nextId}`}>次の試合</Link><Link to={`/NPB/games/${first.gameId}`}>最初の試合</Link></nav>
      <Routes><Route path="/NPB/games/:gameId" element={<NpbGameDetailScreen repository={{ find }} summaryRepository={{ find: summaryFind }} />} /></Routes>
    </MemoryRouter>));
    expect(host.querySelector(".game-mvp__player")).not.toBeNull();
    await act(async () => host.querySelector<HTMLAnchorElement>("nav a")!.click());
    expect(host.querySelector('[aria-label="試合詳細の読み込み中"]')).not.toBeNull();
    expect(host.querySelector(".game-mvp")).toBeNull();
    expect(host.textContent).not.toContain("架空打者");
    await act(async () => host.querySelector<HTMLAnchorElement>("nav a:nth-child(2)")!.click());
    await act(async () => failNext(new Error("HTTP 503")));
    expect(host.querySelector(".game-mvp__player")).not.toBeNull();
    expect(summaryFind).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
