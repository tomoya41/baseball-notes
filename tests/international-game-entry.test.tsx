// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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
  function Address() {
    const location = useLocation(), navigate = useNavigate();
    return <><output>{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Back</button></>;
  }
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
    expect(entry.textContent).toContain("日本代表の結果 · 4試合");
    expect(entry.textContent).toContain("韓国 1 − 5 日本");
    expect(entry.textContent).toContain("大会MVP 宗山塁");
    const row = entry.querySelector("ol.row-list > li:last-child");
    expect(row?.textContent).toContain("日本の本塁打 西川史礁 1本、正木智也 1本");
    expect(row?.textContent).toContain("勝利投手 髙橋宏斗");
    expect(entry.querySelector('.source-note a[href$="20261115_2/"]')).not.toBeNull();
    expect(entry.textContent).toContain("代表に選ばれた選手 · 28人");
    expect(entry.textContent).toContain("出場を確認した選手 · 20人");
    expect(entry.textContent).toContain("宗山塁");
    const appearanceSection = [...entry.querySelectorAll("details")].find(details =>
      details.querySelector("summary")?.textContent?.startsWith("出場を確認した選手"));
    expect(appearanceSection?.textContent).toContain("中森俊介");
    expect(appearanceSection?.textContent).toContain("進藤勇也");
    const appearanceLinks = [...entry.querySelectorAll('a[href*="/NPB/players/"]')];
    expect(appearanceLinks).toHaveLength(20);
    expect(appearanceLinks.find(link => link.textContent?.includes("宗山塁"))?.getAttribute("href"))
      .toBe("/NPB/players/b6286dd6-cf1f-45b8-87e2-95433f8aadb0");
    expect(appearanceLinks.find(link => link.textContent?.includes("武内夏暉"))?.getAttribute("href"))
      .toBe("/NPB/players/6c571e31-d07d-4cb5-9c1c-a9ea83a653e5");
    expect(entry.querySelector('details.source-note details.source-note a[href*="chadwickbureau/register/tree/"]'))
      .not.toBeNull();
    expect(entry.textContent).toContain("2026年11月12〜15日");
    expect(entry.querySelector('a[href$="#schedule"]')?.getAttribute("href")).toBe("https://www.japan-baseball.jp/jp/games/apbc2026/#schedule");
    expect(entry.querySelector('a[href$="player_jpn.html"]')?.textContent).toContain("公式選手一覧");
    const select = entry.querySelector("select")!;
    await act(async () => {
      select.value = "international:tournament:wbc:2023";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(entry.querySelector(".hub-links a")?.getAttribute("href")).toBe("https://www.japan-baseball.jp/jp/team/topteam/2023/wbc/overview.html");
    expect(entry.querySelectorAll("ol.row-list > li")).toHaveLength(7);
    expect(entry.textContent).toContain("アメリカ 2 − 3 日本");
    expect(entry.textContent).not.toContain("宗山塁");
    expect(entry.textContent).not.toContain("勝利投手");
    expect(entry.querySelector('a[href*="/NPB/players/"]')).toBeNull();
    expect(entry.textContent).toContain("打撃成績 · 16人");
    expect(entry.textContent).toContain("投球成績 · 14人");
    expect(entry.textContent).toContain("防御率 1.86 · 9回 2/3");
    expect(entry.textContent).toContain("奪三振は未収録");
    expect(entry.querySelector('.source-note a[href$="oldid=109739294"]')).not.toBeNull();
    expect(entry.querySelector("table")).toBeNull();
    expect(container.querySelector("output")?.textContent)
      .toBe(`${currentUrl}&view=international&tournament=international%3Atournament%3Awbc%3A2023`);
    const back = [...container.querySelectorAll("button")].find(button => button.textContent === "Back")!;
    await act(async () => back.click());
    expect(entry.open).toBe(true);
    expect(select.value).toBe("international:tournament:apbc:2026");
    await act(async () => back.click());
    expect(entry.open).toBe(false);
    expect(container.querySelector("output")?.textContent).toBe(currentUrl);
    expect(container.querySelector('.scoreboard-list a')?.getAttribute("href")).toBe(domesticLink);
    async function openTournament(id: string) {
      await act(async () => internationalButton.click());
      await act(async () => {
        select.value = id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    await openTournament("international:tournament:wbc:2026");
    expect(entry.textContent).toContain("代表に選ばれた選手 · 30人");
    const confirmed = [...entry.querySelectorAll("details")].find(panel =>
      panel.querySelector("summary")?.textContent === "出場を確認した選手 · 11人")!;
    expect(confirmed.open).toBe(false);
    const itoh = [...confirmed.querySelectorAll("li")].find(item => item.querySelector("strong")?.textContent === "伊藤大海");
    expect(itoh?.textContent).toContain("3月14日");
    expect(confirmed.textContent).toContain("本塁打や勝敗投手の記録で確認できた試合のみ");
    expect(entry.textContent).toContain("2月26日時点の発表");
    expect(entry.textContent).toContain("指名打者大谷翔平");
    expect(entry.textContent).toContain("森下翔太");
    expect(entry.textContent).not.toContain("松井裕樹");
    const quarterfinal = entry.querySelector("ol.row-list > li:last-child");
    expect(quarterfinal?.textContent).toContain("日本の本塁打 大谷翔平 1本、森下翔太 1本");
    expect(quarterfinal?.textContent).toContain("敗戦投手 伊藤大海");
    expect(quarterfinal?.textContent).not.toContain("勝利投手");
    expect(entry.querySelector('.source-note a[href$="20260315_1/table.html"]')).not.toBeNull();
    expect(entry.textContent).toContain("準々決勝は現地3月14日、日本時間3月15日です。");
    expect(entry.querySelector('a[href*="/NPB/players/"]')).toBeNull();
    await act(async () => internationalButton.click());
    await openTournament("international:tournament:premier12:2024");
    expect(entry.querySelectorAll("ol.row-list > li")).toHaveLength(9);
    expect(entry.textContent).toContain("チャイニーズ・タイペイ 4 − 0 日本");
    expect(entry.textContent).toContain("打撃成績 · 15人");
    expect(entry.textContent).toContain("投球成績 · 13人");
    expect(entry.textContent).toContain("打率 .357 · 28打数10安打");
    expect(entry.textContent).toContain("6登板 · 12奪三振");
    expect(entry.querySelector('.source-note a[href$="oldid=111780580"]')).not.toBeNull();
    expect(entry.querySelector('.source-note a[href$="20241124_1/table.html"]')).not.toBeNull();
    expect(entry.querySelector('a[href*="/NPB/players/"]')).toBeNull();
    await act(async () => internationalButton.click());
    await openTournament("international:tournament:exhibition:2027:taipei");
    expect(entry.textContent).toContain("2027年3月6・7日、台北ドームで開催予定。");
    expect(entry.textContent).toContain("アプリ未収録");
    expect(entry.querySelector('a[href$="20261118_1.html"]')).not.toBeNull();
    expect(repository.manifest).toHaveBeenCalledOnce();
    expect(repository.date).toHaveBeenCalledExactlyOnceWith(date, index.generatedAt, expect.any(Function));
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
