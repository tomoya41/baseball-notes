// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataExplorerView, ExplorerLinks, MlbDataExplorer, NpbDataExplorer, type ExplorerManifest } from "../src/ui/data-explorer";
import { MlbSeasonExplorer, NpbSeasonExplorer } from "../src/ui/season-explorer";
import { DiscoveryNavigation, MlbDiscovery, NpbDiscovery } from "../src/ui/discovery";
import { StatGlossary } from "../src/ui/stat-glossary";
import { HistoricalCompetitionContext } from "../src/ui/historical-competition-context";
import { services } from "../src/app/services";
import type { ExplorerRow } from "../src/domain/data-explorer";
import type { NpbSeasonPayload } from "../src/application/npb-season-payload";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import type { PlayerRecentResponse } from "../src/domain/player-recent";
import type { GameDateIndex } from "../src/domain/npb-game-index";

const staticValues = vi.hoisted(() => new Map<string, unknown>());
const reader = vi.hoisted(() => vi.fn());
const npbReader = vi.hoisted(() => vi.fn());
vi.mock("../src/ui/use-mlb-historical", () => ({ useHistoricalStatic: (path: string | null) => {
  const value = path ? staticValues.get(path) : null;
  return { path, status: value instanceof Error ? "error" : path && staticValues.has(path) ? "ready" : "missing", value: value instanceof Error ? null : value ?? null, retry: vi.fn() };
} }));
vi.mock("../src/app/historical-products", () => ({ readHistoricalProduct: reader }));
vi.mock("../src/application/explorer-readers", () => ({ readNpbExplorerSeason: npbReader }));
const id = "mlb:player:00000000-0000-4000-8000-000000000001", id2 = "mlb:player:00000000-0000-4000-8000-000000000002", npbId = id.split("player:")[1]!;
const team = "mlb:team:00000000-0000-4000-8000-000000000010";
const metrics = { PA: { value: 100 }, OPS: { value: .950 }, HR: { value: 20 }, outsRecorded: { value: 19 }, ERA: { value: 2 }, K9: { value: 9 } };
const rows: ExplorerRow[] = [{ playerId: id, name: "選手A", teamId: team, batting: metrics, pitching: metrics }, { playerId: id2, name: "選手B", teamId: team, batting: { ...metrics, OPS: { value: null } }, pitching: null }];
const manifest: ExplorerManifest = { seasons: [{ season: 2020, firstDate: "2020-07-23", lastDate: "2020-09-27", coverage: "complete" }, { season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", coverage: "complete" }], teams: [{ id: team, name: "保存球団" }] };
const directory = { players: [{ id, name: "選手A", seasons: [2020, 2025], teamIds: [team], positions: ["P"] }, { id: id2, name: "選手B", seasons: [2025], teamIds: [team], positions: ["OF"] }] };
const profile = { player: directory.players[0], seasonTotals: { "2020": { batting: metrics, pitching: null }, "2025": { batting: metrics, pitching: metrics } }, batting: [], pitching: [] };
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  staticValues.clear(); reader.mockReset(); npbReader.mockReset();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function Probe() { const navigate = useNavigate(); return <><output data-location>{useLocation().search}</output><button onClick={() => navigate(-1)}>戻るテスト</button></>; }
async function mount(child: ReactNode, path = "/MLB/data?season=2025", competition: "regular" | "postseason" = "regular") {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><HistoricalCompetitionContext.Provider value={competition}>{child}<Probe /></HistoricalCompetitionContext.Provider></MemoryRouter>));
}
const click = async (button: Element) => act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const explorer = (readRecent: Parameters<typeof DataExplorerView>[0]["readRecent"] = vi.fn(async () => ({ values: [], failed: [] }))) => <DataExplorerView league="MLB" rows={rows} teams={manifest.teams} season={2025} years={[2020, 2025]} effectiveDate="2025-09-28" coverage="complete" readRecent={readRecent} />;
function seedNpb() {
  const season = { season: 2026, effectiveDate: "2026-10-03", players: [{ playerId: npbId, displayName: "保存選手", teamId: "npb:team:tigers", batting: { metrics }, pitching: null }], coverage: { status: "partial" } } as unknown as NpbSeasonPayload;
  const directory = { effectiveDate: season.effectiveDate, teams: [{ id: "npb:team:tigers", name: "阪神", shortName: "阪神" }], players: [{ playerId: npbId, displayName: "保存選手", teamId: "npb:team:tigers" }] } as NpbPlayerDirectory;
  npbReader.mockResolvedValue(season);
  return { season, directory, deps: { ...services, directory: { findLatestNpb: async () => directory } as unknown as typeof services.directory } };
}
describe("compact exploration UI", () => {
  it("does not perform individual reads in Season mode and shows missing as a dash", async () => {
    const read = vi.fn(async () => ({ values: [], failed: [] })); await mount(explorer(read));
    expect(read).not.toHaveBeenCalled(); expect(container.textContent).toContain("公式ランキング・HOTではありません");
    expect(container.querySelectorAll(".explorer-result")).toHaveLength(2);
    expect(container.querySelectorAll(".explorer-values dd")[4]?.textContent).toBe("—");
    expect(container.querySelector("table")).toBeNull();
  });
  it("applies filters and links canonical players without rank numbers", async () => {
    await mount(explorer(), "/MLB/data?season=2025&metric1=OPS&value1=.9&minimum=50");
    expect(container.querySelectorAll(".explorer-result")).toHaveLength(1);
    expect(container.querySelector(".explorer-result a")?.getAttribute("href")).toBe(`/MLB/players/${encodeURIComponent(id)}?season=2025`);
    expect(container.querySelector(".rank-number")).toBeNull();
  });
  it("preserves URL filters through comparison selection and Back", async () => {
    await mount(explorer(), "/MLB/data?season=2025&metric1=OPS&value1=.9");
    await click(container.querySelector(".explorer-result-title button")!);
    expect(container.querySelector("[data-location]")?.textContent).toContain("compare=");
    await click([...container.querySelectorAll("button")].find(b => b.textContent === "戻るテスト")!);
    expect(container.querySelector("[data-location]")?.textContent).toBe("?season=2025&metric1=OPS&value1=.9");
  });
  it.each([7, 14, 30])("reads only explicit selections for %s days", async days => {
    const read = vi.fn(async () => ({ values: [{ ...rows[0]!, coverage: "partial" }], failed: [id2] }));
    await mount(explorer(read), `/MLB/data?season=2025&period=${days}&recentPlayers=${id},${id2}`);
    expect(read).toHaveBeenCalledExactlyOnceWith([id, id2], days);
    expect(container.textContent).toContain("一部の選択選手を読み込めません");
    expect(container.textContent).toContain("Coverageは一部未確認");
  });
  it("requires a selection before fetching Recent and does not silently ignore unfinished numeric rules", async () => {
    const read = vi.fn(async () => ({ values: [], failed: [] })); await mount(explorer(read), "/MLB/data?period=14&metric1=OPS");
    expect(read).not.toHaveBeenCalled(); expect(container.textContent).toContain("選手を選択");
    expect(container.textContent).toContain("条件1の数値を入力");
  });
  it("retains pitching and recent context when adding to Compare", async () => {
    await mount(explorer(), `/MLB/data?role=pitching&period=14&compare=${id}`);
    const link = [...container.querySelectorAll("a")].find(a => a.textContent?.includes("人を比較へ"));
    expect(link?.getAttribute("href")).toContain("role=pitching&condition=total&period=14d");
  });
  it("paginates to all saved results without mounting an enormous table", async () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...rows[0]!, playerId: `id${i}`, name: `選手${String(i).padStart(2, "0")}` }));
    await mount(<DataExplorerView league="NPB" rows={many} teams={[]} season={2026} years={[2026]} effectiveDate="2026-10-03" coverage="partial" readRecent={async () => ({ values: [], failed: [] })} />);
    expect(container.querySelectorAll(".explorer-result")).toHaveLength(40);
    await click([...container.querySelectorAll("button")].find(b => b.textContent === "次へ")!);
    expect(container.querySelectorAll(".explorer-result")).toHaveLength(5); expect(container.textContent).toContain("2/2ページ");
  });
  it("normalizes the all-season search and old role vocabulary when entering Explorer", async () => {
    await mount(<ExplorerLinks league="NPB" scope="?season=all&role=pitcher&q=保存&kind=team" />);
    const link = [...container.querySelectorAll("a")].find(a => a.textContent === "データ探索")!;
    expect(link.href).not.toContain("season=all"); expect(link.href).toContain("role=pitching"); expect(link.href).not.toContain("kind=");
  });
});
describe("historical identity and competition scope", () => {
  it("shows one-year season totals and refuses a mismatched manifest window", async () => {
    staticValues.set("players/index.json", directory);
    staticValues.set("seasons/2025.json", { season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", players: rows });
    await mount(<MlbDataExplorer manifest={manifest} />);
    expect(container.textContent).toContain("検索結果 2人");
    staticValues.set("seasons/2025.json", { season: 2025, firstDate: "2025-03-18", lastDate: "2024-09-28", players: rows });
    await mount(<MlbDataExplorer manifest={manifest} />);
    expect(container.textContent).toContain("整合を確認できません");
  });
  it("uses team-season facts rather than a player's all-career team association", async () => {
    staticValues.set("players/index.json", directory);
    staticValues.set(`teams/2025/${team.replaceAll(":", "_")}.json`, { season: 2025, effectiveDate: "2025-09-28", players: [{ playerId: id, name: "選手A", batting: { ...metrics, HR: { value: 3 } }, pitching: null }] });
    await mount(<MlbDataExplorer manifest={manifest} />, `/MLB/data?season=2025&team=${team}`);
    expect(container.textContent).toContain("選択球団での出場分"); expect(container.textContent).toContain("検索結果 1人");
    expect(container.querySelectorAll(".explorer-values dd")[2]?.textContent).toBe("3");
  });
  it("loads only the selected profile and preserves the Postseason prefix in Recent", async () => {
    staticValues.set("players/index.json", directory); staticValues.set("seasons/2025.json", { season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", players: rows });
    reader.mockResolvedValue(profile);
    await mount(<MlbDataExplorer manifest={manifest} />, `/MLB/data?season=2025&period=7&recentPlayers=${id}`, "postseason");
    expect(reader).toHaveBeenCalledExactlyOnceWith(`postseason/players/${id.replaceAll(":", "_")}.json`);
    expect(container.querySelectorAll(".explorer-result")).toHaveLength(0); // No appearances in the selected window, not synthetic zero stats.
  });
  it("refuses MLB Current 2026 rather than falling back to 2025", async () => {
    await mount(<MlbDataExplorer manifest={manifest} />, "/MLB/data?season=2026");
    expect(container.textContent).toContain("未収録"); expect(reader).not.toHaveBeenCalled();
  });
  it("shows collected seasons, null role and year-specific links without a Career label", async () => {
    staticValues.set("players/index.json", directory); staticValues.set(`players/${id.replaceAll(":", "_")}.json`, profile);
    await mount(<MlbSeasonExplorer manifest={manifest} />, `/MLB/history?player=${id}&role=pitching&competition=postseason`, "postseason");
    expect(container.textContent).toContain("保存済みシーズン履歴"); expect(container.textContent).toContain("この出場形態の記録はありません");
    expect([...container.querySelectorAll("a")].map(a => a.getAttribute("href"))).toContain(`/MLB/players/${encodeURIComponent(id)}/stats?season=2020&competition=postseason`);
    expect([...container.querySelectorAll("a")].map(a => a.getAttribute("href"))).toContain(`/MLB/compare?players=${encodeURIComponent(id)}&season=2025&role=pitching&competition=postseason`);
    expect(container.querySelector(".explorer-values dd")?.textContent).toBe("6.1");
  });
  it("rejects a profile belonging to another canonical identity", async () => {
    staticValues.set("players/index.json", directory); staticValues.set(`players/${id.replaceAll(":", "_")}.json`, { ...profile, player: { ...profile.player, id: id2 } });
    await mount(<MlbSeasonExplorer manifest={manifest} />, `/MLB/history?player=${id}`);
    expect(container.textContent).toContain("年度別成績を読み込めません"); expect(container.querySelectorAll(".explorer-result")).toHaveLength(0);
  });
});
describe("NPB saved projections and Recent", () => {
  it("keeps partial coverage explicit without opening rankings", async () => {
    const { deps } = seedNpb(); await mount(<NpbDataExplorer services={deps} />, "/NPB/data");
    expect(container.textContent).toContain("一部未確認"); expect(container.querySelector(".rank-number")).toBeNull();
  });
  it("rejects Directory and Season generation-date mismatch", async () => {
    const { directory, deps } = seedNpb(); directory.effectiveDate = "2026-10-02";
    await mount(<NpbDataExplorer services={deps} />, "/NPB/data"); expect(container.textContent).toContain("整合した保存済みSeasonを取得できません");
  });
  it("rejects missing canonical directory references", async () => {
    const { directory, deps } = seedNpb(); directory.players = [];
    await mount(<NpbDataExplorer services={deps} />, "/NPB/data"); expect(container.textContent).toContain("Season・選手一覧の整合");
  });
  it.each(["date", "identity", "window"])("does not display Recent with mismatched %s", async mismatch => {
    const { deps } = seedNpb();
    const payload = { player: { id: mismatch === "identity" ? "wrong" : npbId, name: "保存選手", teamId: "npb:team:tigers" }, asOfDate: mismatch === "date" ? "2026-10-02" : "2026-10-03", period: "7d", batting: { playerId: npbId, from: mismatch === "window" ? "2026-09-01" : "2026-09-27", to: "2026-10-03", coverage: { status: "complete" }, metrics }, pitching: null } as unknown as PlayerRecentResponse;
    await mount(<NpbDataExplorer services={{ ...deps, recent: { find: async () => payload } as unknown as typeof services.recent }} />, `/NPB/data?period=7&recentPlayers=${npbId}`);
    expect(container.textContent).toContain("一部の選択選手を読み込めません"); expect(container.querySelectorAll(".explorer-result")).toHaveLength(0);
  });
  it("does not invent NPB historical seasons or postseason results", async () => {
    seedNpb(); await mount(<NpbSeasonExplorer />, "/NPB/history?season=2025"); expect(container.textContent).toContain("未収録");
    await mount(<NpbDataExplorer services={services} />, "/NPB/data?competition=postseason"); expect(container.textContent).toContain("未収録");
    expect(npbReader).not.toHaveBeenCalled();
  });
  it.each(["season=2025", "season=2026&competition=postseason"])("performs no NPB Season/Directory downloads for unsupported %s", async scope => {
    const { deps } = seedNpb(), findLatestNpb = vi.fn(deps.directory.findLatestNpb);
    await mount(<NpbDataExplorer services={{ ...deps, directory: { findLatestNpb } as unknown as typeof services.directory }} />, `/NPB/data?${scope}`);
    expect(container.textContent).toContain("未収録"); expect(npbReader).not.toHaveBeenCalled(); expect(findLatestNpb).not.toHaveBeenCalled();
    await mount(<NpbSeasonExplorer />, `/NPB/history?${scope}`);
    expect(container.textContent).toContain("未収録"); expect(npbReader).not.toHaveBeenCalled();
  });
});
describe("discovery and glossary", () => {
  it("passes the actual pitching Explorer state to glossary and history links", async () => {
    await mount(<DataExplorerView league="MLB" rows={rows} teams={manifest.teams} season={2020} years={[2020]} effectiveDate="2020-10-27" coverage="complete" readRecent={async () => ({values: [], failed: []})} scope="&competition=postseason" />, "/MLB/data?season=2020&competition=postseason&role=pitching", "postseason");
    const guide = [...container.querySelectorAll("a")].find(a => a.textContent === "指標ガイド")!;
    const target = guide.getAttribute("href")!;
    expect(target).toContain("role=pitching");
    await mount(<StatGlossary league="MLB" />, target, "postseason");
    for (const label of ["データ探索", "シーズン履歴"]) {
      const link = [...container.querySelectorAll("a")].find(a => a.textContent === label)!;
      expect(link.href).toContain("role=pitching"); expect(link.href).toContain("season=2020"); expect(link.href).toContain("competition=postseason");
    }
  });
  it("preserves historical competition through glossary entry, metric search and return links", async () => {
    await mount(<ExplorerLinks league="MLB" scope="?season=2020&competition=postseason&role=pitching&q=Player" />, "/MLB/data?season=2020&competition=postseason", "postseason");
    const guide = [...container.querySelectorAll("a")].find(a => a.textContent === "指標ガイド")!;
    const target = guide.getAttribute("href")!;
    expect(target).toContain("season=2020"); expect(target).toContain("competition=postseason"); expect(target).not.toContain("q=Player");
    await mount(<StatGlossary league="MLB" />, target, "postseason");
    const input = container.querySelector("input")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "OPS"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(container.querySelector("[data-location]")?.textContent).toContain("q=OPS");
    expect(container.querySelector("[data-location]")?.textContent).toContain("season=2020");
    expect(container.querySelector("[data-location]")?.textContent).toContain("competition=postseason");
    for (const label of ["検索", "データ探索", "シーズン履歴"]) {
      const link = [...container.querySelectorAll("a")].find(a => a.textContent === label)!;
      expect(link.href).toContain("season=2020"); expect(link.href).toContain("competition=postseason"); expect(link.href).not.toContain("q=OPS");
    }
  });
  it("does not download Directory or game data for unsupported NPB Postseason discovery", async () => {
    const { deps } = seedNpb(), findLatestNpb = vi.fn(deps.directory.findLatestNpb), manifest = vi.fn(), date = vi.fn();
    await mount(<NpbDiscovery services={{ ...deps, directory: { findLatestNpb } as unknown as typeof services.directory, gameSurface: { manifest, date } as unknown as typeof services.gameSurface }} />, "/NPB/search?kind=game&competition=postseason");
    expect(container.textContent).toContain("Source rights pending");
    expect(findLatestNpb).not.toHaveBeenCalled(); expect(manifest).not.toHaveBeenCalled(); expect(date).not.toHaveBeenCalled();
  });
  it("keeps team discovery independent of an unavailable game manifest", async () => {
    const { deps } = seedNpb();
    const manifest = vi.fn(async () => { throw Error("Game manifest unavailable"); });
    const date = vi.fn();
    await mount(<NpbDiscovery services={{ ...deps, gameSurface: { manifest, date } as unknown as typeof services.gameSurface }} />, "/NPB/search?kind=team");
    expect(container.textContent).toContain("阪神");
    expect(container.textContent).not.toContain("検索用データを取得できません");
    expect(manifest).not.toHaveBeenCalled(); expect(date).not.toHaveBeenCalled();
    expect(container.querySelector(".player-row")?.getAttribute("href")).toBe("/NPB/teams/npb%3Ateam%3Atigers");
  });
  it("provides four search destinations, favorites and scope-correct series links", async () => {
    await mount(<DiscoveryNavigation league="MLB" />, "/MLB/search?season=2020&q=保存");
    const link = [...container.querySelectorAll("a")].find(a => a.textContent === "Series")!;
    expect(link.href).toContain("season=2020"); expect(link.href).toContain("competition=postseason"); expect(container.textContent).toContain("Favoritesから探す");
  });
  it("distinguishes no-games from unknown dates and retains partial-game links", async () => {
    const { deps } = seedNpb();
    const surface = { manifest: async () => ({ from: "2026-10-03", to: "2026-10-03", effectiveDate: "2026-10-03" }), date: async (): Promise<GameDateIndex> => ({ schemaVersion: 1, league: "NPB", date: "2026-10-03", generatedAt: "2026-10-04T00:00:00Z", coverage: "no_games", games: [] }) } as unknown as typeof services.gameSurface;
    await mount(<NpbDiscovery services={{ ...deps, gameSurface: surface }} />, "/NPB/search?kind=game"); expect(container.textContent).toContain("確認済み · 試合なし");
    surface.date = async () => ({ schemaVersion: 1, league: "NPB", date: "2026-10-03", generatedAt: "2026-10-04T00:00:00Z", coverage: "unknown", games: [] });
    await mount(<NpbDiscovery services={{ ...deps, gameSurface: surface }} />, "/NPB/search?kind=game"); expect(container.textContent).not.toContain("確認済み · 試合なし"); expect(container.textContent).toContain("一部確認中");
  });
  it("refuses historical game data from another date", async () => {
    staticValues.set("schedule/2025/2025-09-28.json", { season: 2025, date: "2024-09-28", games: [] });
    await mount(<MlbDiscovery manifest={manifest} />, "/MLB/search?kind=game&season=2025"); expect(container.textContent).toContain("日付・シーズンが一致しません");
  });
  it("rejects nonexistent calendar dates instead of confirming a phantom off-day", async () => {
    await mount(<MlbDiscovery manifest={manifest} />, "/MLB/search?kind=game&season=2025&date=2025-06-31");
    expect(container.textContent).toContain("指定日は収録範囲外です");
    expect(container.textContent).not.toContain("確認済み · 試合なし");
  });
  it("distinguishes an absent off-day file in complete Historical coverage from unavailable data", async () => {
    await mount(<MlbDiscovery manifest={manifest} />, "/MLB/search?kind=game&season=2025&date=2025-09-01");
    expect(container.textContent).toContain("確認済み · 試合なし");
    expect(container.textContent).not.toContain("指定範囲の保存済み情報を取得できません");
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
    const partial = { ...manifest, seasons: manifest.seasons.map(s => ({ ...s, coverage: "partial" })) };
    await mount(<MlbDiscovery manifest={partial} />, "/MLB/search?kind=game&season=2025&date=2025-09-01");
    expect(container.textContent).not.toContain("確認済み · 試合なし");
    expect(container.textContent).toContain("指定範囲の保存済み情報を取得できません");
    staticValues.set("schedule/2025/2025-09-01.json", new Error("Temporary request/validation failure"));
    await mount(<MlbDiscovery manifest={manifest} />, "/MLB/search?kind=game&season=2025&date=2025-09-01");
    expect(container.textContent).not.toContain("確認済み · 試合なし");
    expect(container.textContent).toContain("指定範囲の保存済み情報を取得できません");
  });
  it("uses only actual metrics and offers formula and scope beside their names", async () => {
    await mount(<StatGlossary league="MLB" />, "/MLB/glossary?q=OPS");
    expect(container.textContent).toContain("OPS"); expect(container.querySelector("button[aria-label='OPSの説明']")).not.toBeNull();
    const dialogs = [...document.querySelectorAll("dialog")]; expect(dialogs.some(d => d.textContent?.includes("OBP ＋ SLG"))).toBe(true);
    expect(dialogs.some(d => d.textContent?.includes("Regular SeasonとPostseasonは別集計"))).toBe(true);
    expect(container.textContent).not.toContain("WHIP"); expect(container.textContent).not.toContain("xwOBA");
  });
  it("does not offer unsupported NPB RISP and supports an empty glossary search", async () => {
    await mount(<StatGlossary league="NPB" />, "/NPB/glossary?q=RISP"); expect(container.textContent).toContain("一致する表示指標がありません");
  });
});
