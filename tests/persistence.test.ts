import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { Favorites } from "../src/application/favorites";
import type { SettingsStore } from "../src/application/ports";
import { IndexedDbCache } from "../src/infrastructure/storage";
const player = {
  kind: "player" as const,
  entityId: "canonical-player-1",
  league: "NPB" as const,
};
function settings(): SettingsStore {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
  };
}
describe("favorites", () => {
  it("survives service recreation and removes a saved player", async () => {
    const store = settings();
    await new Favorites(store).toggle(player);
    const restarted = new Favorites(store);
    expect(await restarted.list()).toHaveLength(1);
    await restarted.toggle(player);
    expect(await restarted.list()).toEqual([]);
  });
  it("serializes rapid writes without losing another favorite", async () => {
    const favorites = new Favorites(settings());
    await Promise.all([
      favorites.toggle(player),
      favorites.toggle({ ...player, entityId: "canonical-player-2" }),
    ]);
    expect(await favorites.list()).toHaveLength(2);
  });
  it("does not overwrite corrupt or future-version data", async () => {
    const store = { get: vi.fn(async () => '{"version":99}'), set: vi.fn() };
    await expect(new Favorites(store).toggle(player)).rejects.toThrow(
      "上書きせず",
    );
    expect(store.set).not.toHaveBeenCalled();
  });
  it("reports a failed save and can retry without phantom favorites", async () => {
    const store = settings();
    const set = vi
      .spyOn(store, "set")
      .mockRejectedValueOnce(new Error("quota"));
    const favorites = new Favorites(store);
    await expect(favorites.toggle(player)).rejects.toThrow("quota");
    expect(await favorites.list()).toEqual([]);
    await favorites.toggle(player);
    expect(set).toHaveBeenCalledTimes(2);
    expect(await favorites.list()).toHaveLength(1);
  });
});
describe("IndexedDB cache adapter", () => {
  it("persists snapshots across adapter instances and replaces corrections", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const cache = new IndexedDbCache(name);
    expect(await cache.read("NPB")).toBeUndefined();
    await cache.write("NPB", { version: 1, revision: "a" });
    const restarted = new IndexedDbCache(name);
    expect(await restarted.read("NPB")).toEqual({ version: 1, revision: "a" });
    await restarted.write("NPB", { version: 1, revision: "b" });
    expect(await cache.read("NPB")).toEqual({ version: 1, revision: "b" });
    expect(await cache.read("MLB")).toBeUndefined();
  });
});
