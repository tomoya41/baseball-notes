// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameRecap, NpbGamePreview, GameTeamLinks, PostseasonGameContext } from "../src/ui/game-story";
import { HistoricalCompetitionContext, historicalRouteCompetition } from "../src/ui/historical-competition-context";
import { NpbToday } from "../src/ui/daily-dashboard";
import { MlbPersonalDashboard } from "../src/ui/mlb-personal-dashboard";
import { MlbHistoricalMy } from "../src/ui/mlb-historical";
import { NpbGameDetailView } from "../src/ui/npb-game-detail";
import { services } from "../src/app/services";
import type { NpbGameDetail } from "../src/domain/npb-game-detail";
import type { GameDateIndex, GameIndexRow } from "../src/domain/npb-game-index";
const staticValues = vi.hoisted(() => new Map<string, unknown>());
vi.mock("../src/ui/use-mlb-historical", () => ({ useHistoricalDirectory: () => ({ status: "ready", value: staticValues.get("directory") ?? { players: [] } }), useHistoricalStatic: (path: string | null) => ({ status: path && staticValues.has(path) ? "ready" : "missing", value: path ? staticValues.get(path) ?? null : null }) }));
const home = { id: "npb:team:tigers", name: "阪神", shortName: "阪神", score: null, totals: { pa: null, paSource: "unavailable" as const, ab: null, runs: null, hits: null, homeRuns: null } }, away = { ...home, id: "npb:team:baystars", name: "DeNA", shortName: "DeNA" };
const game: NpbGameDetail = { gameId: "npb:game:scheduled", date: "2026-10-03", gameNumber: 1, status: "scheduled", completeness: null, home, away, batting: { home: [], away: [] }, pitching: { home: [], away: [] } };
const row: GameIndexRow = { gameId: "npb:game:past", date: "2026-10-02", gameNumber: 1, status: "final", scheduledTime: null, home: { id: home.id, name: home.name, score: 1 }, away: { id: away.id, name: away.name, score: 0 }, completeness: "complete", battingAvailable: true, pitchingAvailable: true, detailAvailable: true };
const manifest = { schemaVersion: 1 as const, league: "NPB" as const, from: "2026-10-02", to: "2026-10-04", effectiveDate: "2026-10-02", generatedAt: "2026-10-03T00:00:00Z" };
let container: HTMLDivElement, root: Root;
beforeEach(() => { staticValues.clear(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-03T00:00:00Z")); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const render = async (child: ReactNode, initialEntries = ["/"]) => { await act(async () => root.render(<MemoryRouter initialEntries={initialEntries}>{child}</MemoryRouter>)); };
function LocationProbe() { return <output data-testid="location">{useLocation().search}</output>; }
const actions = { favorites: [], toggle: vi.fn(), saving: false };
describe("daily product surfaces", () => {
  it("sends canonical team keys and retains accessible add/remove labels", async () => { await render(<GameTeamLinks league="NPB" teams={[home, away]} {...actions} />); const button = container.querySelector<HTMLButtonElement>(`[aria-label="阪神をお気に入りに追加"]`)!; await act(async () => button.click()); expect(actions.toggle).toHaveBeenCalledWith({ league: "NPB", kind: "team", entityId: home.id }); expect(container.querySelector(`a[href='/NPB/teams/${encodeURIComponent(home.id)}']`)).not.toBeNull(); });
  it("includes a favorite with zero PA without inventing missing stats", async () => { const id = "00000000-0000-4000-8000-000000000001"; await render(<GameRecap league="NPB" batting={[{ playerId: id, name: "途中出場", teamId: home.id, pa: 0, hits: null, homeRuns: 0, rbi: null }]} pitching={[]} complete={false} favorites={[{ league: "NPB", kind: "player", entityId: id, addedAt: "2026-10-03T00:00:00Z" }]} />); expect(container.textContent).toContain("PA 0 · 安打 — · 本塁打 0 · 打点 —"); expect(container.textContent).toContain("一部データ確認中"); expect(container.querySelector("details")?.textContent).toContain("選出の根拠"); });
  it("keeps historical recap navigation in the selected competition", async () => { await render(<GameRecap league="MLB" batting={[{ playerId: "mlb:player:one", name: "選手", teamId: "mlb:team:one", hits: 2, homeRuns: 1, pa: 4, rbi: 2 }]} pitching={[]} complete scope="?season=2025&competition=postseason" />); expect(container.querySelector(".daily-recap-row")?.getAttribute("href")).toBe("/MLB/players/mlb%3Aplayer%3Aone?season=2025&competition=postseason"); });
  it("does not expose Recap for scheduled games", async () => { await render(<NpbGameDetailView payload={game} state="ready" />); expect(container.textContent).not.toContain("この試合の主な数字"); expect(container.textContent).toContain("開始前"); });
  it("does not fabricate prior-season summaries using data after the game", async () => { const date = vi.fn(async (d: string): Promise<GameDateIndex> => ({ schemaVersion: 1, league: "NPB", date: d, generatedAt: manifest.generatedAt, coverage: "complete", games: d === row.date ? [row] : [] })); await render(<NpbGamePreview game={game} favorites={[]} services={{ ...services, product: { ...services.product, teamSeason: async () => ({ effectiveDate: "2026-10-04" }) as Awaited<ReturnType<typeof services.product.teamSeason>> } as unknown as typeof services.product, gameSurface: { ...services.gameSurface, manifest: async () => manifest, date } as unknown as typeof services.gameSurface }} />); expect(container.textContent).toContain("試合前時点のシーズン成績は未収録"); expect(container.textContent).toContain("1勝 / 1試合"); expect(date.mock.calls.every(([d]) => d < game.date)).toBe(true); expect(container.textContent).not.toContain("予告先発投手:"); });
  it("announces unconfirmed Today while retaining old results and explicit JST", async () => { const date = async (d: string): Promise<GameDateIndex> => ({ schemaVersion: 1, league: "NPB", date: d, generatedAt: manifest.generatedAt, coverage: "unknown", games: d === row.date ? [row] : [] }); await render(<NpbToday {...actions} services={{ ...services, gameSurface: { ...services.gameSurface, manifest: async () => manifest, date } as unknown as typeof services.gameSurface }} />); expect(container.textContent).toContain("2026-10-03 · 日本時間"); expect(container.textContent).toContain("今日の予定は未確認"); expect(container.textContent).toContain("最近終了した試合"); expect(container.textContent).not.toContain("今日は試合なし"); });
  it("filters Today to canonical favorite teams without inventing their missing games", async () => { const date = async (d: string): Promise<GameDateIndex> => ({ schemaVersion: 1, league: "NPB", date: d, generatedAt: manifest.generatedAt, coverage: "unknown", games: d === game.date ? [{ ...row, date: d }] : [] }); await render(<NpbToday {...actions} personal favorites={[{ league: "NPB", kind: "team", entityId: "npb:team:giants", addedAt: "2026-10-03T00:00:00Z" }]} services={{ ...services, gameSurface: { ...services.gameSurface, manifest: async () => manifest, date } as unknown as typeof services.gameSurface }} />); expect(container.textContent).toContain("保存済みの今日の試合にフォロー球団はありません"); expect(container.querySelectorAll(".scoreboard-row")).toHaveLength(0); });
  it("leaves unsupported MLB years unavailable instead of using 2025 as Today", async () => { await render(<MlbPersonalDashboard directory={{status:"ready",value:{players:[]}}} {...actions} season={2026} manifest={{ seasons: [{ season: 2025, firstDate: "2025-03-18", lastDate: "2025-09-28", coverage: "complete" }], teams: [] }} />); expect(container.textContent).toContain("未収録"); expect(container.textContent).not.toContain("今日の試合"); });
  it("preserves active postseason scope on every dashboard team, game, player and analysis link", async () => {
    const id = "mlb:player:one", teamId = "mlb:team:one", gameId = "mlb:game:one";
    staticValues.set("teams/2025/mlb_team_one.json", { W: 1, L: 0, effectiveDate: "2025-10-01", games: [{ gameId, date: "2025-10-01", homeTeamId: teamId, awayTeamId: "mlb:team:two", homeRuns: 1, awayRuns: 0, complete: true, number: 1 }] });
    staticValues.set("players/mlb_player_one.json", { batting: [{ gameId, date: "2025-10-01", season: 2025, playerId: id, teamId, opponentTeamId: "mlb:team:two", home: true, pa: 4, ab: 3, hits: 1, homeRuns: 0, runs: 1, rbi: 0, doubles: 0, triples: 0, bb: 1, hbp: 0, sh: 0, sf: 0, so: 1, sb: 0, cs: 0, starter: true, battingOrder: 1 }], pitching: [] });
    await render(<HistoricalCompetitionContext.Provider value="postseason"><MlbPersonalDashboard directory={{ status: "ready", value: { players: [{ id, name: "選手", seasons: [2025], positions: [], teamIds: [teamId], postseasonOnly: true }] } }} {...actions} favorites={[{ league: "MLB", kind: "player", entityId: id, addedAt: "2026-10-03T00:00:00Z" }, { league: "MLB", kind: "team", entityId: teamId, addedAt: "2026-10-03T00:00:00Z" }]} season={2025} manifest={{ seasons: [{ season: 2025, firstDate: "2025-09-30", lastDate: "2025-11-01", coverage: "complete" }], teams: [{ id: teamId, name: "球団" }] }} /></HistoricalCompetitionContext.Provider>);
    const links = [...container.querySelectorAll("a")].map(a => a.getAttribute("href")!);
    expect(links.some(href => href.includes("/games/"))).toBe(true);
    expect(links.some(href => href.includes("/trends?"))).toBe(true);
    expect(links.every(href => href.includes("season=2025") && href.includes("competition=postseason"))).toBe(true);
    expect(container.textContent).toContain("Postseason過去記録");
    expect(container.textContent).toContain("出場 0 · 安打 — · 本塁打 —");
    expect(container.textContent).not.toContain("· HR");
  });
  it("displays played wins separately from a rule credit at the selected game", async () => {
    staticValues.set("postseason/hub/2025.json", { series: [{ id: "series", winsRequired: 4, teams: [{ teamId: "a", advantageWins: 1 }, { teamId: "b", advantageWins: 0 }], games: [{ gameId: "one", status: "final", winnerId: "b" }, { gameId: "two", status: "final", winnerId: "a" }] }] });
    await render(<PostseasonGameContext season={2025} gameId="one" names={id => id === "a" ? "優勝球団" : "対戦球団"} />);
    expect(container.textContent).toContain("優勝球団 0勝 + アドバンテージ 1勝（Series合計 1勝） / 対戦球団 1勝");
    expect(container.textContent).not.toContain("優勝球団 1勝");
    expect(container.textContent).not.toContain("Series決着");
  });
  it("keeps competition and other context when changing the My season", async () => {
    await render(<><MlbHistoricalMy {...actions} manifest={{ schemaVersion: 1, league: "MLB", current2026: "unavailable", teams: [], seasons: [2024, 2025].map(season => ({ season, firstDate: `${season}-09-30`, lastDate: `${season}-11-01`, coverage: "complete", games: 1, playerCount: 1 })) }} /><LocationProbe /></>, ["/MLB/my?season=2025&competition=postseason&context=saved"]);
    const select = container.querySelector("select")!;
    await act(async () => { select.value = "2024"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const params = new URLSearchParams(container.querySelector("output")!.textContent!);
    expect(params.get("season")).toBe("2024");
    expect(params.get("competition")).toBe("postseason");
    expect(params.get("context")).toBe("saved");
  });
  it("keeps a both-competition player in postseason from the complete saved list", async () => {
    const id = "mlb:player:both";
    staticValues.set("directory", { players: [{ id, name: "両スコープ選手", seasons: [2025], positions: [], teamIds: [] }] });
    expect(historicalRouteCompetition("/MLB/my", "?competition=postseason")).toBe("postseason");
    expect(historicalRouteCompetition("/MLB/my", "?season=2025")).toBe("regular");
    await render(<HistoricalCompetitionContext.Provider value="postseason"><MlbHistoricalMy {...actions} favorites={[{ league: "MLB", kind: "player", entityId: id, addedAt: "2026-10-03T00:00:00Z" }]} manifest={{ schemaVersion: 1, league: "MLB", current2026: "unavailable", teams: [], seasons: [{ season: 2025, firstDate: "2025-09-30", lastDate: "2025-11-01", coverage: "complete", games: 47, playerCount: 1 }] }} /></HistoricalCompetitionContext.Provider>, ["/MLB/my?season=2025&competition=postseason"]);
    const playerLinks = [...container.querySelectorAll("a")].filter(a => a.getAttribute("href")?.includes("/players/"));
    expect(playerLinks).toHaveLength(2);
    expect(playerLinks.every(a => a.getAttribute("href")?.endsWith("?season=2025&competition=postseason"))).toBe(true);
  });
});
