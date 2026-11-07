// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Services } from "../src/app/services";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import type { NpbRecords } from "../src/domain/npb-records";
import { NpbMyScreen } from "../src/ui/npb-my-screen";
import { NpbSavedPlayers } from "../src/ui/npb-my";
import { NpbRecordsScreen, RecordsView } from "../src/ui/npb-records-screen";

const hitter = "00000000-0000-4000-8000-000000000001", pitcher = "00000000-0000-4000-8000-000000000002";
const player = (playerId: string, playerType: "fielder" | "pitcher") => ({ playerId, displayName: playerType === "pitcher" ? "投手の長い登録名" : "野手の長い登録名",
  teamId: "npb:team:tigers", position: null, playerType, birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
  battingAvailable: playerType === "fielder", pitchingAvailable: playerType === "pitcher", recentAvailable: true });
const directory: NpbPlayerDirectory = { schemaVersion: 2, league: "NPB", effectiveDate: "2026-10-12", generatedAt: "2026-10-13T00:00:00Z",
  teams: [{ id: "npb:team:tigers", name: "阪神タイガース", shortName: "阪神" }], players: [player(hitter, "fielder"), player(pitcher, "pitcher")] };
const records: NpbRecords = { schemaVersion: 1, league: "NPB", season: 2026, effectiveDate: "2026-10-12", coverage: "partial",
  readiness: "not_ready", qualifierStatus: "pending", reasons: ["season_coverage_not_complete"],
  categories: [{ role: "batting", metric: "HR", rows: [] }] };
let div: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); div = document.createElement("div"); document.body.append(div); root = createRoot(div); });
afterEach(async () => { await act(async () => root.unmount()); div.remove(); vi.unstubAllGlobals(); });
const render = async (node: ReactNode) => { await act(async () => root.render(<MemoryRouter initialEntries={["/NPB/my?season=2026"]}>{node}</MemoryRouter>)); };

it("opens followed hitter and pitcher analysis with their canonical IDs and roles", async () => {
  const favorites = [hitter, pitcher].map(entityId => ({ league: "NPB" as const, kind: "player" as const, entityId, addedAt: "2026-10-12T00:00:00Z" }));
  const toggle = vi.fn(), findLatestNpb = vi.fn(async () => directory);
  await render(<NpbSavedPlayers repository={{ findLatestNpb }} favorites={favorites} toggle={toggle} saving={false} />);
  const routes = [...div.querySelectorAll("a")].map(link => link.getAttribute("href"));
  for (const [id, role] of [[hitter, "batting"], [pitcher, "pitching"]]) {
    expect(routes).toContain(`/NPB/players/${id}/seasons?season=2026&role=${role}`);
    expect(routes).toContain(`/NPB/compare?players=${id}&role=${role}`);
    expect(routes).toContain(`/NPB/moves?player=${id}`);
  }
  await act(async () => div.querySelector<HTMLButtonElement>('button[aria-label="投手の長い登録名をお気に入りから削除"]')!.click());
  expect(toggle).toHaveBeenCalledExactlyOnceWith({ kind: "player", league: "NPB", entityId: pitcher });
  expect(findLatestNpb).toHaveBeenCalledOnce();
  expect(div.textContent).toContain("保存済み");
});

it("keeps unresolved Favorites removable without creating player or analysis routes", async () => {
  const toggle = vi.fn();
  await render(<NpbSavedPlayers repository={{ findLatestNpb: async () => { throw new Error("offline"); } }}
    favorites={[{ league: "NPB", kind: "player", entityId: "unresolved-id", addedAt: "2026-10-12T00:00:00Z" }]} toggle={toggle} saving={false} />);
  expect(div.textContent).toContain("選手情報を読み込めません");
  expect(div.querySelector('a[href*="unresolved-id"]')).toBeNull();
  await act(async () => div.querySelector<HTMLButtonElement>(".favorite-button")!.click());
  expect(toggle).toHaveBeenCalledWith({ kind: "player", league: "NPB", entityId: "unresolved-id" });
});

it("keeps My section navigation local and does not fetch profiles for the empty start", async () => {
  const reads = vi.fn(() => { throw new Error("No acquisition needed"); });
  const services = new Proxy({}, { get: reads }) as Services;
  function Address() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
  await render(<><NpbMyScreen services={services} favorites={[]} toggle={() => {}} saving={false} /><Address /></>);
  const scroll = vi.fn();
  div.querySelector<HTMLElement>("#my-library")!.scrollIntoView = scroll;
  await act(async () => [...div.querySelectorAll<HTMLButtonElement>(".my-section-actions button")].find(button => button.textContent === "保存・整理")!.click());
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: "start" });
  expect(div.querySelector("output")?.textContent).toBe("/NPB/my?season=2026");
  expect(reads).not.toHaveBeenCalled();
  expect(div.querySelectorAll(".watch-summary")).toHaveLength(1);
  expect(div.querySelector('a[href="/NPB/library?tab=views"]')).not.toBeNull();
});

it("keeps closed ranking data hidden while useful record destinations remain available", async () => {
  const invalidCandidates = { ...records, categories: [{ role: "batting" as const, metric: "HR" as const,
    rows: [{ playerId: hitter, displayName: "公開してはいけない候補", rank: 1, value: 12 }] }] };
  await render(<RecordsView payload={invalidCandidates} />);
  expect(div.textContent).toContain("シーズン集計を確認中");
  expect(div.textContent).not.toContain("公開してはいけない候補");
  await render(<NpbRecordsScreen repository={{ records: async () => records }} />);
  for (const path of ["/NPB/awards", "/NPB/milestones", "/NPB/history?season=2025"]) expect(div.querySelector(`a[href="${path}"]`)).not.toBeNull();
  expect(div.textContent).toContain("2026年 · 公式戦");
  expect(div.textContent).not.toContain("0位");
});

it("preserves real zero values and tied ranks in verified records", async () => {
  const ready: NpbRecords = { ...records, readiness: "ready", coverage: "complete", qualifierStatus: "verified", reasons: [],
    categories: [{ role: "batting", metric: "HR", rows: [{ playerId: hitter, displayName: "野手", rank: 1, value: 0 },
      { playerId: pitcher, displayName: "投手", rank: 1, value: 0 }] }] };
  await render(<RecordsView payload={ready} />);
  expect([...div.querySelectorAll(".records-rank strong")].map(item => item.textContent)).toEqual(["1", "1"]);
  expect([...div.querySelectorAll(".records-value")].map(item => item.textContent)).toEqual(["0", "0"]);
  expect(div.querySelector(`a[href="/NPB/players/${hitter}"]`)).not.toBeNull();
});

it("retries a failed Records read without substituting an empty ranking", async () => {
  const read = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(records);
  await render(<NpbRecordsScreen repository={{ records: read }} />);
  expect(div.textContent).toContain("記録データを読み込めません");
  expect(div.textContent).not.toContain("順位の公開待ち");
  await act(async () => [...div.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "再試行")!.click());
  expect(div.textContent).toContain("順位の公開待ち");
  expect(read).toHaveBeenCalledTimes(2);
});
