import { beforeEach, describe, expect, it, vi } from "vitest";
import npb from "../public/data/npb.json";
import mlb from "../public/data/mlb.json";
import { PlayerRepository } from "../src/application/player-repository";
import type { CacheStore, PlayerProvider } from "../src/application/ports";
import { normalizeSample } from "../src/infrastructure/providers/sample-provider";

const start = Date.parse("2026-09-23T10:00:00Z");
let now: number;
let values: Map<string, unknown>;
let cache: CacheStore;
let provider: PlayerProvider;
beforeEach(() => {
  now = start;
  values = new Map();
  cache = {
    read: vi.fn(async (key) => values.get(key)),
    write: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
  };
  provider = {
    id: "sample-v1",
    policy: {
      cacheTtlMs: 1_000,
      maxSourceAgeMs: 86_400_000,
      allowPersistence: true,
    },
    loadCatalog: vi.fn(async (league) =>
      normalizeSample(league === "NPB" ? npb : mlb, league),
    ),
  };
});
describe("repository freshness and failures", () => {
  it("reuses fresh persisted data across repository instances and isolates leagues", async () => {
    await new PlayerRepository(provider, cache, () => now).load("NPB");
    const repo = new PlayerRepository(provider, cache, () => now);
    expect((await repo.load("NPB")).freshness.origin).toBe("cache");
    expect((await repo.load("MLB")).data.league).toBe("MLB");
    expect(provider.loadCatalog).toHaveBeenCalledTimes(2);
  });
  it("refreshes at the exact TTL boundary and replaces corrected snapshots", async () => {
    const repo = new PlayerRepository(provider, cache, () => now);
    await repo.load("NPB");
    now += 1_000;
    vi.mocked(provider.loadCatalog).mockResolvedValue(
      normalizeSample({ ...npb, revision: "correction-2" }, "NPB"),
    );
    expect((await repo.load("NPB")).data.source.revision).toBe("correction-2");
    expect(provider.loadCatalog).toHaveBeenCalledTimes(2);
  });
  it("does not make delayed source data fresh simply by fetching again", async () => {
    now += 86_400_000;
    expect(
      (await new PlayerRepository(provider, cache, () => now).load("NPB"))
        .freshness.state,
    ).toBe("stale");
  });
  it("falls back to stale cache on network failure, even during forced refresh", async () => {
    const repo = new PlayerRepository(provider, cache, () => now);
    await repo.load("NPB");
    vi.mocked(provider.loadCatalog).mockRejectedValue(new Error("offline"));
    const result = await repo.load("NPB", true);
    expect(result.freshness).toMatchObject({ state: "stale", origin: "cache" });
    expect(result.warnings.join()).toContain("更新できなかった");
    expect(result.freshness.fetchedAt).toBe(new Date(start).toISOString());
  });
  it("rejects when offline with no valid cache", async () => {
    vi.mocked(provider.loadCatalog).mockRejectedValue(new Error("offline"));
    await expect(
      new PlayerRepository(provider, cache).load("NPB"),
    ).rejects.toThrow("取得できません");
  });
  it("recovers from incompatible/corrupted cache and reports it", async () => {
    values.set("catalog:v2:sample-v1:NPB", { version: 999 });
    const result = await new PlayerRepository(provider, cache, () => now).load(
      "NPB",
    );
    expect(result.data.profiles).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);
  });
  it("keeps data visible when persistence fails", async () => {
    vi.mocked(cache.write).mockRejectedValue(new Error("quota"));
    const result = await new PlayerRepository(provider, cache, () => now).load(
      "NPB",
    );
    expect(result.warnings.join()).toContain("保存できません");
    expect(result.data.profiles).toHaveLength(2);
  });
  it("never reads/writes persisted data when provider prohibits persistence", async () => {
    provider.policy.allowPersistence = false;
    await new PlayerRepository(provider, cache, () => now).load("NPB");
    expect(cache.read).not.toHaveBeenCalled();
    expect(cache.write).not.toHaveBeenCalled();
  });
  it("deduplicates overlapping loads", async () => {
    const repo = new PlayerRepository(provider, cache, () => now);
    await Promise.all([repo.load("NPB"), repo.load("NPB")]);
    expect(provider.loadCatalog).toHaveBeenCalledTimes(1);
  });
  it("aborts a stalled provider and recovers for a later attempt", async () => {
    vi.mocked(provider.loadCatalog).mockImplementation(
      (_league, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("timeout"));
          });
        }),
    );
    const repo = new PlayerRepository(provider, cache, () => now, 5);
    await expect(repo.load("NPB")).rejects.toThrow("取得できません");
    vi.mocked(provider.loadCatalog).mockResolvedValue(
      normalizeSample(npb, "NPB"),
    );
    await expect(repo.load("NPB")).resolves.toBeDefined();
  });
  it("rejects wrong-league and future-dated provider responses", async () => {
    const repo = new PlayerRepository(provider, cache, () => now);
    vi.mocked(provider.loadCatalog).mockResolvedValue(
      normalizeSample(mlb, "MLB"),
    );
    await expect(repo.load("NPB")).rejects.toThrow();
    vi.mocked(provider.loadCatalog).mockResolvedValue(
      normalizeSample({ ...npb, updated_at: "2027-01-01T00:00:00Z" }, "NPB"),
    );
    await expect(repo.load("NPB")).rejects.toThrow();
  });
});
