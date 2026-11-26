// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NpbScheduleScreen } from "../src/ui/npb-game-surface";
import { NpbTeamActivity } from "../src/ui/team-hub";
import { services } from "../src/app/services";
import { mvpFixture } from "./fixtures/daily-mvp";
import { canonicalDeepLink } from "../src/domain/native-navigation";
import { portableRoute } from "../src/domain/product-sharing";

it.each([
  ["apbc:2023", "section=awards", "awards"],
  ["apbc:2023", "section=appearances", "appearances"],
  ["apbc:2023", "section=selections", "selections"],
  ["wbc:2023", "statRole=batting", "batting"],
  ["premier12:2024", "statRole=pitching", "pitching"],
])("opens only the requested detail from a profile or shared link for %s (%s)", async (tournament, selection, detail) => {
  const { index } = mvpFixture();
  const repository = {
    manifest: vi.fn(async () => ({ schemaVersion: 1 as const, league: "NPB" as const, from: index.date, to: index.date,
      effectiveDate: index.date, generatedAt: index.generatedAt })),
    date: vi.fn(async () => index), recent: vi.fn(), records: vi.fn(),
  };
  const route = `/NPB/schedule?date=${index.date}&view=international&tournament=${encodeURIComponent(`international:tournament:${tournament}`)}&${selection}`;
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[route]}><NpbScheduleScreen repository={repository}/></MemoryRouter>));
    expect(container.querySelector<HTMLDetailsElement>("[data-international-entry]")?.open).toBe(true);
    expect([...container.querySelectorAll<HTMLDetailsElement>("[data-international-detail][open]")].map(panel =>
      panel.dataset.internationalDetail)).toEqual([detail]);

    const select = container.querySelector("select")!;
    await act(async () => {
      select.value = "international:tournament:apbc:2026";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector("[data-international-detail][open]")).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it("opens the 2025 exhibition draw directly and keeps its official box scores under the source disclosure", async () => {
  const { index } = mvpFixture(), date = index.date;
  const repository = {
    manifest: vi.fn(async () => ({ schemaVersion: 1 as const, league: "NPB" as const, from: date, to: date,
      effectiveDate: date, generatedAt: index.generatedAt })),
    date: vi.fn(async () => index), recent: vi.fn(), records: vi.fn(),
  };
  const path = "/NPB/schedule";
  const query = `season=2026&date=${date}&view=international&tournament=international%3Atournament%3Aexhibition%3A2025%3Akorea`;
  const route = `${path}?${query}`;
  expect(portableRoute(path, query)).toBe(route);
  expect(canonicalDeepLink(`baseballnotes://NPB/schedule?${query}`)).toBe(route);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[route]}><NpbScheduleScreen repository={repository}/></MemoryRouter>));
    const entry = container.querySelector<HTMLDetailsElement>("[data-international-entry]")!;
    expect(entry.open).toBe(true);
    expect(entry.querySelector("h2")?.textContent).toBe("侍ジャパンシリーズ2025 韓国戦");
    expect(entry.querySelector("li:last-child strong")?.textContent).toBe("日本 7 − 7 韓国");
    expect(entry.querySelector("li:last-child small")?.textContent).toContain("引き分け");
    expect(entry.textContent).toContain("代表選手・個人成績は未収録です");
    const sources = entry.querySelector<HTMLDetailsElement>(".source-note")!;
    expect(sources.open).toBe(false);
    expect([...sources.querySelectorAll(".hub-links a")].map(link => link.getAttribute("href")))
      .toEqual([
        "https://www.japan-baseball.jp/jp/team/topteam/score/20251115_1/",
        "https://www.japan-baseball.jp/jp/team/topteam/score/20251116_1/",
      ]);
    const select = entry.querySelector("select")!;
    await act(async () => {
      select.value = "international:tournament:exhibition:2025:netherlands";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(entry.textContent).toContain("オランダ 0 − 5 日本");
    expect(entry.textContent).toContain("日本 9 − 0 オランダ");
    expect(entry.textContent).not.toContain("引き分け");
    expect(container.querySelector(".scoreboard-list a")?.getAttribute("href"))
      .toBe(`/NPB/games/${encodeURIComponent(index.games[0]!.gameId)}?date=${date}`);
  } finally { await act(async () => root.unmount()); }
});

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
    const awards = (title: string) => [...entry.querySelectorAll("details")].find(panel =>
      panel.querySelector("summary")?.textContent === title)!;
    const wbcAwards = () => awards("オールWBCチーム · 日本代表");
    const bestNine = () => awards("大会ベストナイン · 日本代表");
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
    const pitchingSection = [...entry.querySelectorAll("details")].find(details =>
      details.querySelector("summary")?.textContent === "登板・投球回 · 13人")!;
    expect(pitchingSection.open).toBe(false);
    expect(pitchingSection.textContent).toContain("日本戦4試合 · チーム計34回");
    const pitcherLinks = [...pitchingSection.querySelectorAll("a")];
    expect(pitcherLinks).toHaveLength(13);
    const zeroOutPitcher = pitcherLinks.find(link => link.textContent?.includes("中森俊介"));
    expect([...zeroOutPitcher!.querySelectorAll("small")].map(node => node.textContent))
      .toEqual(["1登板 · 0回", "11月13日 0回（アウトなし）"]);
    expect(pitcherLinks.find(link => link.textContent?.includes("森田駿哉"))?.textContent).toContain("2登板 · 2回");
    const appearanceLinks = [...appearanceSection!.querySelectorAll('a[href*="/NPB/players/"]')];
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
    expect(entry.textContent).not.toContain("登板・投球回");
    const formerWbcLinks = [...entry.querySelectorAll('a[href*="/NPB/players/"]')];
    expect(formerWbcLinks).toHaveLength(18);
    expect(formerWbcLinks.some(link => link.textContent?.includes("大谷翔平"))).toBe(false);
    expect(entry.textContent).toContain("打撃成績 · 16人");
    expect(entry.textContent).toContain("投球成績 · 14人");
    expect(entry.textContent).toContain("大会MVP 大谷翔平");
    expect(wbcAwards().open).toBe(false);
    expect([...wbcAwards().querySelectorAll("li")].map(row => row.textContent))
      .toEqual(["大谷翔平投手", "吉田正尚外野手", "大谷翔平指名打者"]);
    expect(wbcAwards().querySelector("a")).toBeNull();
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
    await openTournament("international:tournament:apbc:2023");
    expect(entry.querySelectorAll("ol.row-list > li")).toHaveLength(4);
    expect(entry.textContent).toContain("韓国 3 − 4 日本");
    expect(entry.textContent).toContain("日本の本塁打・勝利投手・投球回を収録");
    expect(entry.textContent).toContain("大会MVP 門脇誠");
    expect(bestNine().open).toBe(false);
    expect(bestNine().querySelectorAll("li")).toHaveLength(5);
    expect(bestNine().querySelector('a[href="/NPB/players/1581526b-5601-4a6b-8b4e-021709be1e47"]')?.textContent)
      .toContain("門脇誠二塁手");
    expect(entry.textContent).toContain("日本の本塁打 0本");
    const apbc2023Pitching = [...entry.querySelectorAll("details")].find(panel =>
      panel.querySelector("summary")?.textContent === "登板・投球回 · 12人")!;
    expect(apbc2023Pitching.open).toBe(false);
    expect(apbc2023Pitching.textContent).toContain("日本戦4試合 · チーム計36回");
    const selectedPitchers = [...apbc2023Pitching.querySelectorAll("li")];
    const rowWithName = (name: string) => selectedPitchers.find(row => row.querySelector("strong")?.textContent === name)!;
    expect(rowWithName("田口麗斗").querySelector("a")?.getAttribute("href"))
      .toBe("/NPB/players/d1a2f152-f77d-4bc8-8f56-73c60e395458");
    expect(rowWithName("田口麗斗").textContent).toContain("3登板 · 3回");
    expect(rowWithName("吉村貢司郎").textContent).toContain("2登板 · 2回 2/3");
    expect(rowWithName("今井達也").querySelector("a")).toBeNull();
    expect(rowWithName("根本悠楓").querySelector("a")).toBeNull();
    expect(apbc2023Pitching.querySelectorAll("a")).toHaveLength(10);
    const apbcRoster = [...entry.querySelectorAll("details")].find(panel =>
      panel.querySelector("summary")?.textContent === "代表に選ばれた選手 · 26人")!;
    expect(apbcRoster.open).toBe(false);
    expect(apbcRoster.textContent).toContain("11月6日時点の発表");
    expect(apbcRoster.textContent).toContain("野村佑希");
    expect(apbcRoster.textContent).not.toContain("紅林弘太郎");
    const apbcAppearances = [...entry.querySelectorAll("details")].find(panel =>
      panel.querySelector("summary")?.textContent === "出場を確認した選手 · 26人")!;
    expect(apbcAppearances.open).toBe(false);
    expect(apbcAppearances.querySelectorAll("a")).toHaveLength(23);
    expect(apbcAppearances.querySelector('a[href="/NPB/players/1581526b-5601-4a6b-8b4e-021709be1e47"]')?.textContent)
      .toContain("11月16日、11月17日、11月18日、11月19日");
    expect(entry.querySelector('.source-note a[href$="oldid=111760584"]')?.textContent).toContain("日本語版の試合結果・投球回");
    expect(entry.querySelector('.source-note a[href$="/20231119_2/table.html"]')).not.toBeNull();
    expect(entry.querySelector('.hub-links a[href$="/apbc2023/"]')).not.toBeNull();
    expect(container.querySelector("output")?.textContent)
      .toBe(`${currentUrl}&view=international&tournament=international%3Atournament%3Aapbc%3A2023`);
    expect(container.querySelector('.scoreboard-list a')?.getAttribute("href")).toBe(domesticLink);
    await openTournament("international:tournament:wbc:2026");
    expect(entry.textContent).toContain("代表に選ばれた選手 · 30人");
    const confirmed = [...entry.querySelectorAll("details")].find(panel =>
      panel.querySelector("summary")?.textContent === "出場を確認した選手 · 30人")!;
    expect(confirmed.open).toBe(false);
    const itoh = [...confirmed.querySelectorAll("li")].find(item => item.querySelector("strong")?.textContent === "伊藤大海");
    expect(itoh?.textContent).toContain("3月7日、3月14日");
    expect(confirmed.textContent).toContain("先発・バッテリー、本塁打・勝敗投手の記録で確認できた試合を掲載");
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
    const wbcProfileLinks = [...entry.querySelectorAll('a[href*="/NPB/players/"]')];
    expect(wbcProfileLinks).toHaveLength(22);
    expect(wbcProfileLinks.find(link => link.textContent?.includes("森下翔太"))?.getAttribute("href"))
      .toBe("/NPB/players/92a02594-a4f7-498c-bb83-8a41855b4645");
    expect(wbcProfileLinks.find(link => link.textContent?.includes("伊藤大海"))?.getAttribute("href"))
      .toBe("/NPB/players/e894c7ec-cf2d-4000-98d4-4211c1a4b345");
    expect(wbcProfileLinks.some(link => link.textContent?.includes("大谷翔平"))).toBe(false);
    expect([...wbcAwards().querySelectorAll("li")].map(row => row.textContent)).toEqual(["大谷翔平指名打者"]);
    expect(entry.querySelector('.source-note a[href$="2026-world-baseball-classic-all-tournament-team"]')).not.toBeNull();
    expect(wbcProfileLinks.find(link => link.textContent?.includes("若月健矢"))?.getAttribute("href"))
      .toBe("/NPB/players/0849d339-1434-46b4-9382-a748c1c797a0");
    expect(wbcProfileLinks.find(link => link.textContent?.includes("源田壮亮"))?.textContent).toContain("3月6日、3月7日、3月8日、3月14日");
    expect(entry.querySelector('a[href$="/stats/japan/2026"]')?.textContent).toContain("打撃成績");
    expect(entry.querySelector('a[href$="/stats/pitching/japan"]')?.textContent).toContain("投球成績");
    expect(entry.textContent).toContain("出場を確認した選手 · 30人");
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
    const premierLinks = [...entry.querySelectorAll('a[href*="/NPB/players/"]')];
    expect(premierLinks).toHaveLength(31);
    expect([...bestNine().querySelectorAll("li strong")].map(row => row.textContent)).toEqual(["坂倉将吾", "小園海斗", "森下翔太"]);
    expect(premierLinks.find(link => link.textContent?.includes("清水達也"))?.getAttribute("href"))
      .toBe("/NPB/players/64c9071f-f9df-4227-afb5-faee4fc73d0d");
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

function offSeasonSchedule() {
  const { index } = mvpFixture();
  const effective = "2026-10-12", lastGameDate = "2026-10-08";
  const observation = { ...index, date: effective, coverage: "unknown" as const, games: [] };
  const result = { ...index, date: lastGameDate, games: index.games.map(game => ({ ...game, date: lastGameDate })) };
  const recent = { effectiveDate: effective, generatedAt: index.generatedAt, games: result.games };
  const repository = {
    manifest: vi.fn(async () => ({ schemaVersion: 1 as const, league: "NPB" as const, from: "2026-03-27",
      to: effective, effectiveDate: effective, generatedAt: index.generatedAt })),
    date: vi.fn(async (date: string) => date === lastGameDate ? result : observation),
    recent: vi.fn(async () => recent), records: vi.fn(),
  };
  return { repository, observation, result, recent };
}

async function mountOffSeasonSchedule(repository: ReturnType<typeof offSeasonSchedule>["repository"], path: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><NpbScheduleScreen repository={repository} /></MemoryRouter>));
  return { host, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

it("opens the last confirmed result on the undated schedule and preserves the selected observation date", async () => {
  const { repository } = offSeasonSchedule();
  const { host, unmount } = await mountOffSeasonSchedule(repository, "/NPB/schedule?season=2026");
  try {
    expect(host.querySelector('input[aria-label="試合日"]')?.getAttribute("value")).toBe("2026-10-08");
    expect(host.querySelector(".scoreboard-list a")?.getAttribute("href")).toContain("date=2026-10-08");
    expect(host.textContent).toContain("公開基準日 2026-10-12");
    expect(host.textContent).toContain("直近の収録結果 2026-10-08");
    const observation = [...host.querySelectorAll("a")].find(link => link.textContent?.includes("基準日の収録状況"))!;
    expect(observation.getAttribute("href")).toBe("/NPB/schedule?season=2026&date=2026-10-12");
    await act(async () => observation.click());
    expect(host.textContent).toContain("公式戦の収集対象期間外です");
    expect(host.querySelector(".scoreboard-list a")).toBeNull();
    expect(host.textContent).not.toContain("試合なし");
    expect(repository.recent).toHaveBeenCalledOnce();
  } finally { await unmount(); }
});

it.each(["recorded no-games", "failed Day", "different generation", "mismatched final score"])(
  "does not replace the observation date when the fallback is inapplicable: %s", async reason => {
    const { repository, observation, result, recent } = offSeasonSchedule();
    if (reason === "recorded no-games") repository.date.mockResolvedValueOnce({ ...observation, coverage: "no_games" });
    if (reason === "failed Day") repository.date.mockResolvedValueOnce({ ...observation, coverage: "failed" });
    if (reason === "different generation") repository.recent.mockResolvedValueOnce({ ...recent, generatedAt: "2026-10-15T12:00:00Z" });
    if (reason === "mismatched final score") repository.date.mockResolvedValueOnce(observation).mockResolvedValueOnce({
      ...result, games: result.games.map(game => ({ ...game, away: { ...game.away, score: (game.away.score ?? 0) + 1 } })),
    });
    const { host, unmount } = await mountOffSeasonSchedule(repository, "/NPB/schedule");
    try {
      expect(host.querySelector('input[aria-label="試合日"]')?.getAttribute("value")).toBe("2026-10-12");
      expect(host.querySelector(".scoreboard-list a")).toBeNull();
      const reasonLabel = reason === "recorded no-games" ? "試合なし" : reason === "failed Day"
        ? "この日の試合データを取得できませんでした" : "公式戦の収集対象期間外です";
      expect(host.textContent).toContain(reasonLabel);
      if (reason === "recorded no-games" || reason === "failed Day") expect(repository.recent).not.toHaveBeenCalled();
    } finally { await unmount(); }
  },
);

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
