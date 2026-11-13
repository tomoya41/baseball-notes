// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NpbScheduleScreen } from "../src/ui/npb-game-surface";
import { NpbTeamActivity } from "../src/ui/team-hub";
import { services } from "../src/app/services";
import { mvpFixture } from "./fixtures/daily-mvp";

it("opens real official tournament links alongside the domestic Games route without extra data requests", async () => {
  const { index } = mvpFixture(), date = index.date;
  const repository = {
    manifest: vi.fn(async () => ({ schemaVersion: 1 as const, league: "NPB" as const, from: date, to: date,
      effectiveDate: date, generatedAt: index.generatedAt })),
    date: vi.fn(async () => index), recent: vi.fn(), records: vi.fn(),
  };
  const currentUrl = `/NPB/schedule?date=${date}&season=2026`;
  function Address() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[currentUrl]}>
      <NpbScheduleScreen repository={repository}/><Address/>
    </MemoryRouter>));
    const entry = container.querySelector<HTMLDetailsElement>("[data-international-entry]")!;
    expect(entry.open).toBe(false);
    const domesticLink = container.querySelector('.scoreboard-list a')?.getAttribute("href");
    expect(domesticLink).toBe(`/NPB/games/${encodeURIComponent(index.games[0]!.gameId)}?date=${date}`);
    const internationalButton = [...container.querySelectorAll("button")].find(button => button.textContent === "侍ジャパン")!;
    await act(async () => internationalButton.click());
    expect(entry.open).toBe(true);
    expect(entry.textContent).toContain("アプリ未収録");
    expect(entry.textContent).toContain("2026年11月12〜15日");
    expect(entry.querySelector('a[href$="#schedule"]')?.getAttribute("href")).toBe("https://www.japan-baseball.jp/jp/games/apbc2026/#schedule");
    expect(entry.querySelector('a[href$="player_jpn.html"]')?.textContent).toContain("公式選手一覧");
    const select = entry.querySelector("select")!;
    await act(async () => {
      select.value = "international:tournament:wbc:2023";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(entry.querySelector("a")?.href).toBe("https://www.japan-baseball.jp/jp/team/topteam/2023/wbc/overview.html");
    expect(entry.querySelector("table")).toBeNull();
    expect(container.querySelector("output")?.textContent).toBe(currentUrl);
    expect(container.querySelector('.scoreboard-list a')?.getAttribute("href")).toBe(domesticLink);
    expect(repository.manifest).toHaveBeenCalledOnce();
    expect(repository.date).toHaveBeenCalledExactlyOnceWith(date);
    expect(repository.recent).not.toHaveBeenCalled();
    expect(repository.records).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("withholds mixed-generation schedules and reloads without dropping the club or date", async () => {
  const { index } = mvpFixture();
  const date = index.date;
  const url = `/NPB/schedule?date=${date}&team=npb%3Ateam%3Atigers`;
  const repository = {
    manifest: vi.fn(async () => ({ schemaVersion: 1 as const, league: "NPB" as const, from: date, to: date, effectiveDate: date, generatedAt: index.generatedAt })),
    date: vi.fn(async () => index).mockResolvedValueOnce({ ...index, generatedAt: "2026-09-25T23:00:00Z", games: [], coverage: "no_games" }),
    recent: vi.fn(), records: vi.fn(),
  };
  function Address() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[url]}><NpbScheduleScreen repository={repository}/><Address/></MemoryRouter>));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("日程を読み込めません");
    expect(host.textContent).not.toContain("試合なし");
    const retry = [...host.querySelectorAll("button")].find(button => button.textContent === "日程を再読み込み")!;
    await act(async () => retry.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector(".scoreboard-list a")).not.toBeNull();
    expect(host.querySelector("output")?.textContent).toBe(url);
    expect(repository.manifest).toHaveBeenCalledTimes(2);
    expect(repository.date).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("withholds club results when any day has a different generation from the manifest", async () => {
  const { index } = mvpFixture();
  const gameSurface = {
    manifest: async () => ({ schemaVersion: 1 as const, league: "NPB" as const,
      from: index.date, to: "2026-09-26", effectiveDate: "2026-09-26", generatedAt: index.generatedAt }),
    date: vi.fn(async () => index).mockResolvedValueOnce(index).mockResolvedValueOnce({
      ...index, date: "2026-09-26", generatedAt: "2026-09-25T23:00:00Z", coverage: "no_games", games: [],
    }),
    recent: vi.fn(), records: vi.fn(),
  };
  const standings = { ...services.standings, findLatestNpb: async () => null } as typeof services.standings;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter><NpbTeamActivity teamId="npb:team:tigers"
      services={{ ...services, standings, gameSurface: gameSurface as unknown as typeof services.gameSurface }} /></MemoryRouter>));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("最近の試合を読み込めません");
    expect(host.querySelector(".scoreboard-list")).toBeNull();
    expect(host.querySelector('a[href="/NPB/schedule?team=npb%3Ateam%3Atigers"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); }
});
