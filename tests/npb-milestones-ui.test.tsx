// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { npbSeasonMilestonesSchema } from "../src/domain/npb-season-milestones";
import { NpbMilestonesScreen } from "../src/ui/npb-milestones";
import { StaticNpbProductRepository } from "../src/infrastructure/providers/static-npb-product-repository";
import { createPublicFetch, type CachedResponse } from "../src/infrastructure/public-response-cache";

const payload = npbSeasonMilestonesSchema.parse({ schemaVersion: 1, league: "NPB", season: 2026,
  effectiveDate: "2026-09-30", generatedAt: "2026-10-01T00:00:00Z", period: { from: "2026-03-27", to: "2026-09-30" },
  scope: "stored_regular_season_facts", careerAvailable: false, coverage: { status: "partial",
    summary: { dates: 1, complete: 0, noGames: 0, partial: 1, unknown: 0, failed: 0 } },
  players: [{ playerId: "00000000-0000-4000-8000-000000000001", displayName: "保存済み選手", teamId: null, teamName: null,
    checkpoints: [{ role: "batting", metric: "H", count: 51, previousCheckpoint: 50, nextCheckpoint: 100 }] }] });
function request(overrides: { disabled?: boolean; failure?: boolean; stale?: boolean; staleGeneration?: boolean; empty?: boolean } = {}): typeof fetch {
  return async url => String(url).endsWith("capabilities.json") ? Response.json({ schemaVersion: 1, league: "NPB",
    effectiveDate: "2026-09-30", generatedAt: payload.generatedAt, coverage: payload.coverage,
    data: { seasonMilestones: { available: !overrides.disabled, status: overrides.disabled ? "source_unavailable" : "partially_available", reasons: [], known: null, total: null } } }) :
    overrides.failure ? new Response(null, { status: 503 }) : Response.json({ ...payload,
      effectiveDate: overrides.stale ? "2026-09-29" : payload.effectiveDate,
      generatedAt: overrides.staleGeneration ? "2026-09-30T00:00:00Z" : payload.generatedAt,
      period: { ...payload.period, to: overrides.stale ? "2026-09-29" : payload.period.to }, players: overrides.empty ? [] : payload.players });
}
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function mount(fetcher: typeof fetch, path = "/NPB/milestones") {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><NpbMilestonesScreen repository={new StaticNpbProductRepository("https://example.test/", fetcher)} /></MemoryRouter>));
}
describe("Season milestone connection without changing the finished UI", () => {
  it("shows stored counts, partial scope and canonical navigation, with no rankings", async () => {
    await mount(request());
    expect(container.textContent).toContain("保存済み成績"); expect(container.textContent).toContain("未収録・確認中");
    expect(container.textContent).toContain("保存済み選手"); expect(container.textContent).toContain("51");
    expect(container.querySelector('a[href="/NPB/players/00000000-0000-4000-8000-000000000001/stats"]')).not.toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  });
  it("keeps Career Coming Soon with zero data requests", async () => {
    const fetcher = vi.fn(request()); await mount(fetcher, "/NPB/milestones?tab=1");
    expect(container.textContent).toContain("COMING SOON"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("shows an explicit unavailable state for legacy capability payloads", async () => {
    await mount(request({ disabled: true })); expect(container.textContent).toContain("シーズンの節目は準備中");
    expect(container.textContent).not.toContain("保存済み選手");
  });
  it.each([{ failure: true }, { stale: true }, { staleGeneration: true }])("handles HTTP/stale data safely: %s", async override => {
    await mount(request(override)); expect(container.querySelector('[role="alert"]')?.textContent).toContain("読み込めません");
    expect(container.textContent).not.toContain("保存済み選手");
  });
  it("commits only generation-matched milestones and validates offline fallback again", async () => {
    const saved = new Map<string, CachedResponse>(); let online = true, body = { ...payload, generatedAt: "2026-09-30T00:00:00Z" };
    const store = { get: async (url: string) => saved.get(url), put: async (row: CachedResponse) => { saved.set(row.url, row); },
      remove: async (url: string) => { saved.delete(url); } };
    const fetcher = createPublicFetch(store, async () => Response.json(body), () => online);
    const repository = new StaticNpbProductRepository("https://example.test/", fetcher);
    await expect(repository.seasonMilestones(2026, payload)).rejects.toThrow(/generation mismatch/);
    expect(saved.size).toBe(0);
    body = payload; expect(await repository.seasonMilestones(2026, payload)).toEqual(payload);
    expect(saved.size).toBe(1); const good = [...saved.values()][0]!.body;
    body = { ...payload, generatedAt: "2026-09-30T00:00:00Z" };
    await expect(repository.seasonMilestones(2026, payload)).rejects.toThrow(/generation mismatch/);
    expect([...saved.values()][0]!.body).toEqual(good);
    online = false; expect(await repository.seasonMilestones(2026, payload)).toEqual(payload);
    await expect(repository.seasonMilestones(2026, { ...payload, generatedAt: "2026-10-02T00:00:00Z" })).rejects.toThrow(/generation mismatch/);
  });
  it("shows empty data instead of fabricating progress", async () => {
    await mount(request({ empty: true })); expect(container.textContent).toContain("表示できる保存済み成績はありません");
  });
  it("supports search with an accessible label and no extra fetch", async () => {
    const fetcher = vi.fn(request()); await mount(fetcher, "/NPB/milestones?q=存在しない");
    expect(container.textContent).toContain("表示できる保存済み成績はありません");
    expect(container.querySelector("label")?.textContent).toContain("選手名"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("keeps the shell and loading state while waiting", async () => {
    await mount(() => new Promise(() => {}));
    expect(container.querySelector('[aria-label="読み込み中"]')).not.toBeNull(); expect(container.querySelector("h1")?.textContent).toBe("達成記録");
  });
});
