// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { services } from "../src/app/services";
import { createPublicFetch, clearSavedResponseFallback, hasSavedResponseFallback, type CachedResponse } from "../src/infrastructure/public-response-cache";
import { StaticGameSurfaceRepository } from "../src/infrastructure/providers/static-game-surface-repository";
import { NpbSavedGames } from "../src/ui/daily-dashboard";
import { NpbScheduleScreen } from "../src/ui/npb-game-surface";
import { mvpFixture } from "./fixtures/daily-mvp";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); clearSavedResponseFallback(); });

it("refreshes a selected date in place and saves only matching publications", async () => {
  const { index } = mvpFixture();
  const { date, generatedAt } = index;
  const manifest = { schemaVersion: 1, league: "NPB", from: date, to: date, effectiveDate: date, generatedAt };
  const candidate = { ...manifest, generatedAt: "2026-10-01T12:00:00Z" };
  const refreshed = { ...index, generatedAt: candidate.generatedAt,
    games: [{ ...index.games[0]!, home: { ...index.games[0]!.home, score: 12 } }] };
  const url = `/NPB/schedule?date=${date}&team=${encodeURIComponent(index.games[0]!.home.id)}&view=international`;
  const saved = new Map<string, CachedResponse>();
  let manifestOnHost = manifest, dayOnHost = index, online = true, now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const fetchActual = vi.fn<typeof fetch>(async input => Response.json(String(input).endsWith("manifest.json") ? manifestOnHost : dayOnHost));
  const repository = new StaticGameSurfaceRepository("https://example.test/", createPublicFetch({
    get: async key => saved.get(key), put: async row => { saved.set(row.url, row); }, remove: async key => { saved.delete(key); },
  }, fetchActual, () => online));
  const host = document.createElement("div"), root = createRoot(host);
  document.body.append(host);
  function Address() { const { pathname, search } = useLocation(); return <output>{pathname + search}</output>; }
  const screen = (key: string) => <MemoryRouter key={key} initialEntries={[url]}><NpbScheduleScreen repository={repository}/><Address/></MemoryRouter>;
  const score = () => host.querySelector(".scoreboard-list a")?.getAttribute("aria-label");
  const manifestUrl = "https://example.test/data/npb/games/manifest.json";
  const reopen = async () => act(async () => {
    now += 31_000;
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("baseball:foreground"));
  });
  try {
    await act(async () => root.render(screen("initial")));
    const initialScore = score();
    expect(initialScore).toBeTruthy();
    expect(saved.size).toBe(2);

    manifestOnHost = candidate;
    await reopen();
    expect(fetchActual).toHaveBeenCalledTimes(4);
    expect(host.textContent).toContain("更新を確認できないため、保存済みの日程を表示しています");
    expect(score()).toBe(initialScore);
    expect(new TextDecoder().decode(saved.get(manifestUrl)?.body)).toContain(generatedAt);
    expect(host.querySelector<HTMLDetailsElement>("[data-international-entry]")?.open).toBe(true);

    online = false;
    await act(async () => root.render(screen("offline")));
    expect(score()).toBe(initialScore);
    expect(hasSavedResponseFallback()).toBe(true);
    online = true;
    dayOnHost = refreshed;
    await reopen();
    expect(score()).toContain(" 12、");
    expect(host.querySelector("output")?.textContent).toBe(url);
    expect(host.textContent).not.toContain("更新を確認できないため");
    expect(new TextDecoder().decode(saved.get(manifestUrl)?.body)).toContain(candidate.generatedAt);
    expect(hasSavedResponseFallback()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("checks the Home feed periodically only when visible and retains the dated result on failure", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const { index } = mvpFixture();
  const recent = vi.fn(async () => ({ games: index.games, effectiveDate: index.date }));
  const setDate = vi.fn();
  const deps = { ...services, gameSurface: { recent } as unknown as typeof services.gameSurface };
  const host = document.createElement("div"), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(<MemoryRouter><NpbSavedGames services={deps} onEffectiveDate={setDate}/></MemoryRouter>));
    expect(recent).toHaveBeenCalledOnce();
    visibility.mockReturnValue("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(recent).toHaveBeenCalledOnce();
    recent.mockRejectedValueOnce(new Error("publication unavailable"));
    visibility.mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(recent).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("更新を確認できないため");
    expect(host.textContent).toContain(`${index.date}までの保存済み結果`);
    recent.mockResolvedValueOnce({ games: index.games, effectiveDate: "2026-10-01" });
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(recent).toHaveBeenCalledTimes(3);
    expect(host.textContent).not.toContain("更新を確認できないため");
    expect(setDate).toHaveBeenLastCalledWith("2026-10-01");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
