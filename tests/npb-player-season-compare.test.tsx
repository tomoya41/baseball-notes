// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Services } from "../src/app/services";
import { readNpbHistoricalManifest, readNpbHistoricalSeason } from "../src/application/npb-historical-reader";
import { readPublishedPlayerStats } from "../src/application/npb-published-player";
import { NpbPlayerSeasonCompare } from "../src/ui/npb-player-season-compare";
import { cohortFixture, cohortId } from "./fixtures/npb-cohort";

vi.mock("../src/application/npb-historical-reader", () => ({ readNpbHistoricalManifest: vi.fn(), readNpbHistoricalSeason: vi.fn() }));
vi.mock("../src/application/npb-published-player", () => ({ readPublishedPlayerStats: vi.fn() }));
const fixture = cohortFixture();
const metric = (value: number) => ({ value, status: "complete" as const, factCount: 3, observedFacts: 3 });
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(readNpbHistoricalManifest).mockResolvedValue(fixture.manifest);
  vi.mocked(readNpbHistoricalSeason).mockResolvedValue(fixture.data);
  vi.mocked(readPublishedPlayerStats).mockResolvedValue({
    period: { from: "2026-03-27", to: "2026-10-12" }, effectiveDate: "2026-10-12", generatedAt: "2026-10-13T00:00:00Z",
    coverage: { status: "partial", summary: { dates: 1, complete: 0, noGames: 0, partial: 1, unknown: 0, failed: 0 } },
    player: { playerId: cohortId(0), displayName: "同姓同名", teamId: "npb:team:tigers",
      batting: { factCount: 3, metrics: { PA: metric(15), HR: metric(0), OPS: metric(0.730) } }, pitching: null },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

async function mount(search: string) {
  const findLatestNpb = vi.fn().mockResolvedValue({ players: [{ playerId: cohortId(0), displayName: "同姓同名" }] });
  const directory = { findLatestNpb } as unknown as Services["directory"];
  const host = document.createElement("div"), root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/season-compare?entity=${cohortId(0)}&${search}`]}>
    <NpbPlayerSeasonCompare directory={directory} />
  </MemoryRouter>));
  return { host, findLatestNpb, close: async () => { await act(async () => root.unmount()); } };
}

it("compares archived club rows and the saved 2026 series without merging sources or qualifying ranks", async () => {
  const f = await mount("years=2025,2026&metric=HR");
  try {
    const [archive, saved] = f.host.querySelectorAll(".comparison-bar");
    expect(archive!.textContent).toContain("114打席");
    expect(archive!.textContent).toContain("阪神 / ソフトバンク");
    expect(archive!.textContent).toContain("公式戦・球団別成績（一部収録）");
    const sources = f.host.querySelector<HTMLDetailsElement>(".season-comparison-sources")!;
    expect(sources.open).toBe(false);
    expect(sources.querySelector('a[href*="oldid=100"]')).not.toBeNull();
    expect(sources.querySelector('a[href="https://nf3.sakura.ne.jp/"]')).not.toBeNull();
    expect(f.host.querySelectorAll(".season-comparison-sources")).toHaveLength(1);
    expect(saved!.textContent).toContain("2026-03-27〜2026-10-12");
    expect(saved!.textContent).toContain("球団別の内訳は未収録");
    expect(saved!.textContent).toContain("15打席");
    expect(saved!.querySelector(":scope > span")?.textContent).toBe("0");
    const annual = new URL(saved!.querySelector("a")!.getAttribute("href")!, "https://example.test");
    expect(annual.searchParams.get("season")).toBe("2026");
    expect(annual.searchParams.get("role")).toBe("batting");
    expect(f.host.textContent).not.toContain("前年差");
  } finally { await f.close(); }
});

it("distinguishes an unrecorded year from a failed annual read and keeps the independent saved row", async () => {
  const missing = await mount("years=2024,2026");
  try {
    expect(missing.host.textContent).toContain("この年の打撃成績は未収録");
    expect(readNpbHistoricalSeason).not.toHaveBeenCalled();
  } finally { await missing.close(); }
  vi.mocked(readNpbHistoricalSeason).mockRejectedValueOnce(Error("offline"));
  const failed = await mount("years=2025,2026");
  try {
    expect(failed.host.textContent).toContain("この年の成績を読み込めませんでした");
    expect(failed.host.textContent).toContain("15打席");
    const retry = [...failed.host.querySelectorAll("button")].find(button => button.textContent === "もう一度読み込む")!;
    await act(async () => retry.click());
    expect(failed.host.textContent).toContain("114打席");
  } finally { await failed.close(); }
});

it.each(["years=2027", "season=2027", "competition=postseason", "stage=npb_cs_final"])("holds unsupported scopes before fetching %s", async search => {
  const f = await mount(search);
  try {
    expect(f.host.textContent).toContain("指定の年度や試合区分の成績は未収録");
    expect(f.findLatestNpb).not.toHaveBeenCalled();
    expect(readNpbHistoricalManifest).not.toHaveBeenCalled();
    expect(readPublishedPlayerStats).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
