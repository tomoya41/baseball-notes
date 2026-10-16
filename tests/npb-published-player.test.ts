import { afterEach, expect, it, vi } from "vitest";
import { publishedPlayerStats, readPublishedPlayerStats } from "../src/application/npb-published-player";
import { readNpbExplorerSeason, readNpbRecentExplorer } from "../src/application/explorer-readers";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import type { NpbSeasonPayload } from "../src/application/npb-season-payload";
vi.mock("../src/application/explorer-readers", () => ({ readNpbExplorerSeason: vi.fn(), readNpbRecentExplorer: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const directory = { effectiveDate: "2026-10-12", players: [{ playerId: id, displayName: "対象選手", teamId: "npb:team:tigers" }] } as NpbPlayerDirectory;
const payload = { effectiveDate: directory.effectiveDate, generatedAt: "2026-10-14T00:00:00Z", period: { from: "2026-03-27", to: "2026-10-08" }, coverage: { status: "partial", summary: { partial: 5 } }, players: [{ playerId: id, displayName: "対象選手", teamId: "npb:team:tigers", batting: null, pitching: { factCount: 1, metrics: { ERA: { value: null, status: "unavailable", observedFacts: 0, factCount: 1 } } } }] } as unknown as NpbSeasonPayload;
afterEach(() => vi.clearAllMocks());
it("preserves saved dates, metric nulls and partial coverage without fabricating day evidence", () => {
  const value = publishedPlayerStats(payload, directory, id)!;
  expect(value.coverage).toBe(payload.coverage); expect(value.period.to).toBe("2026-10-08");
  expect(value.player.pitching?.metrics.ERA?.value).toBeNull(); expect(value).not.toHaveProperty("calendar");
  expect(value).not.toHaveProperty("readiness");
});
it("rejects different observation dates and mismatched canonical display identity", () => {
  expect(() => publishedPlayerStats({ ...payload, effectiveDate: "2026-10-13" }, directory, id)).toThrow("date");
  expect(() => publishedPlayerStats({ ...payload, players: [{ ...payload.players[0]!, teamId: "different" }] }, directory, id)).toThrow("identity");
});
it("does not invent zero appearances for missing identities or saved rows", () => {
  expect(publishedPlayerStats(payload, directory, "missing")).toBeNull();
  expect(publishedPlayerStats({ ...payload, players: [] }, directory, id)).toBeNull();
});
it.each(["7d", "14d", "30d"] as const)("reads the exact %s projection without substituting a season", async period => {
  vi.mocked(readNpbRecentExplorer).mockResolvedValue(payload as never);
  await readPublishedPlayerStats(id, period, { findLatestNpb: async () => directory });
  expect(readNpbRecentExplorer).toHaveBeenCalledExactlyOnceWith(Number(period.slice(0, -1)), directory);
  expect(readNpbExplorerSeason).not.toHaveBeenCalled();
});
it("coalesces concurrent Season fallbacks and never reads a monthly approximation", async () => {
  vi.mocked(readNpbExplorerSeason).mockResolvedValue(payload);
  const repository = { findLatestNpb: async () => directory };
  await Promise.all([readPublishedPlayerStats(id, "season", repository), readPublishedPlayerStats(id, "season", repository)]);
  expect(readNpbExplorerSeason).toHaveBeenCalledTimes(1);
  await expect(readPublishedPlayerStats(id, "currentMonth", repository)).rejects.toThrow("monthly");
  expect(readNpbRecentExplorer).not.toHaveBeenCalled();
});
it("does not retain a failed snapshot promise", async () => {
  vi.mocked(readNpbExplorerSeason).mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce(payload);
  const repository = { findLatestNpb: async () => directory };
  await expect(readPublishedPlayerStats(id, "season", repository)).rejects.toThrow("offline");
  expect(await readPublishedPlayerStats(id, "season", repository)).not.toBeNull();
});
