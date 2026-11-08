// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NpbScheduleScreen } from "../src/ui/npb-game-surface";
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
