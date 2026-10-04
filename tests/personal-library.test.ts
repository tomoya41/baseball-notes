import { describe, expect, it } from "vitest";
import { PersonalLibrary, PERSONAL_LIBRARY_KEY, activityFromRoute, activityPath, viewConditions } from "../src/application/personal-library";
const player = "00000000-0000-4000-8000-000000000001", mlb = `mlb:player:${player}`;
function setup(now = 1000000000000) {
  const data = new Map<string, string>(); let serial = 0;
  const storage = { get: async (k: string) => data.get(k) ?? null, set: async (k: string, v: string) => { data.set(k, v); } };
  return { data, storage, store: new PersonalLibrary(storage, () => now, () => `local-${++serial}`), now };
}
describe("versioned local personal library", () => {
  it("creates, renames, deletes and reloads Collections without touching Favorites", async () => {
    const { store, data, storage } = setup(); data.set("baseball:favorites:v1", "existing");
    const c = (await store.createCollection("若手")).collections[0]!;
    await store.setPlayer(c.id, { league: "NPB", playerId: player }, true);
    await store.setPlayer(c.id, { league: "NPB", playerId: player }, true);
    await store.setPlayer(c.id, { league: "MLB", playerId: mlb }, true);
    await store.renameCollection(c.id, "比較候補");
    const reload = await new PersonalLibrary(storage).read();
    expect(reload.collections[0]!.name).toBe("比較候補"); expect(reload.collections[0]!.players).toHaveLength(2);
    await store.setPlayer(c.id, { league: "NPB", playerId: player }, false);
    expect((await store.read()).collections[0]!.players).toEqual([{ league: "MLB", playerId: mlb }]);
    await store.removeCollection(c.id); await store.reset(); expect(data.get("baseball:favorites:v1")).toBe("existing");
  });
  it("serializes simultaneous edits so separate collections/players are not lost", async () => {
    const { store } = setup(); await Promise.all([store.createCollection("A"), store.createCollection("B")]);
    const c = (await store.read()).collections[0]!;
    await Promise.all([store.setPlayer(c.id, { league: "NPB", playerId: player }, true), store.setPlayer(c.id, { league: "MLB", playerId: mlb }, true)]);
    expect((await store.read()).collections).toHaveLength(2); expect((await store.read()).collections[0]!.players).toHaveLength(2);
  });
  it("saves reproducible scope/filter/metric state but no local comparison or pagination IDs", async () => {
    const { store } = setup(); const params = new URLSearchParams("season=2025&competition=postseason&period=14&role=batting&team=team&minimum=10&metric1=HR&value1=2&sort1=OPS&metrics=OPS,HR&q=選手&compare=private&page=5&localId=private");
    const s = await store.saveView("条件", "MLB", "data", params), v = s.views[0]!;
    const saved = new URLSearchParams(v.conditions);
    expect(saved.get("competition")).toBe("postseason"); expect(saved.get("metrics")).toBe("OPS,HR"); expect(saved.has("compare")).toBe(false); expect(saved.has("localId")).toBe(false);
    expect(`/${v.league}/${v.kind}?${v.conditions}`).not.toContain(v.id);
    await store.removeView(v.id); expect((await store.read()).views).toEqual([]);
  });
  it("deduplicates and bounds canonical Activity, excludes searches and expires old items", async () => {
    const { store, now, data } = setup(); const a = activityFromRoute(`/NPB/players/${player}`, "?season=2026&q=private&recentPlayers=private", now)!;
    await store.visit(a); await store.visit({ ...a, visitedAt: now + 1 });
    // A future timestamp is rejected during read; use the same clock for normal persisted visits.
    await store.visit(a);
    expect((await store.read()).activity).toHaveLength(1); expect(data.get(PERSONAL_LIBRARY_KEY)).not.toContain("private");
    for (let i = 0; i < 70; i++) await store.visit({ ...a, conditions: `season=${2000 + i}` });
    expect((await store.read()).activity).toHaveLength(60);
    const stale = JSON.parse(data.get(PERSONAL_LIBRARY_KEY)!); stale.activity[0].visitedAt = now - 91 * 86400000; data.set(PERSONAL_LIBRARY_KEY, JSON.stringify(stale));
    expect((await store.read()).activity).toHaveLength(59); await store.clearActivity(); expect((await store.read()).activity).toEqual([]);
  });
  it.each(["teams", "games", "players"])("restores %s canonical paths and competition context", kind => {
    const entity = `mlb:${kind === "teams" ? "team" : kind === "games" ? "game" : "player"}:${player}`;
    const a = activityFromRoute(`/MLB/${kind}/${encodeURIComponent(entity)}`, "?season=2025&competition=postseason", 1)!;
    expect(a.entityId).toBe(entity); expect(activityPath(a)).toContain(encodeURIComponent(entity)); expect(activityPath(a)).toContain("competition=postseason");
  });
  it("supports Series/Explorer history and rejects unrelated/external/bad routes", () => {
    expect(activityFromRoute(`/MLB/postseason/series/mlb:series:${player}`, "?season=2025", 1)?.kind).toBe("series");
    expect(activityFromRoute("/NPB/data", "?q=private&metric1=OPS&value1=.9", 1)?.conditions).toBe("metric1=OPS&value1=.9");
    expect(activityFromRoute("/MLB/history", "?player=abc", 1)?.kind).toBe("history");
    expect(activityFromRoute("/NPB/search", "?q=private", 1)).toBeNull(); expect(activityFromRoute("/BAD/data", "", 1)).toBeNull();
    expect(activityFromRoute("/MLB/players/%ZZ", "", 1)).toBeNull(); expect(activityFromRoute(`/NPB/players/${mlb}`, "", 1)).toBeNull();
    expect(viewConditions(new URLSearchParams("url=https://evil&credential=secret"))).toBe("");
  });
  it.each(["invalid json", JSON.stringify({ version: 99, views: [], collections: [], activity: [] })])("keeps corrupt/future storage intact until explicit reset", async raw => {
    const { store, data } = setup(); data.set(PERSONAL_LIBRARY_KEY, raw);
    await expect(store.read()).rejects.toThrow(); await expect(store.createCollection("new")).rejects.toThrow(); expect(data.get(PERSONAL_LIBRARY_KEY)).toBe(raw);
    await store.reset(); expect((await store.read()).collections).toEqual([]);
  });
  it("migrates version 0, deduplicates old members, preserves Favorites and persists on next edit", async () => {
    const { store, data, now } = setup(); data.set(PERSONAL_LIBRARY_KEY, JSON.stringify({ version: 0, views: [], collections: [{ id: "old", name: "旧", players: [{ league: "NPB", playerId: player }, { league: "NPB", playerId: player }], updatedAt: now }] }));
    expect((await store.read()).collections[0]!.players).toHaveLength(1); await store.createCollection("new"); expect(JSON.parse(data.get(PERSONAL_LIBRARY_KEY)!).version).toBe(1);
  });
  it("survives quota failure without losing existing persisted items", async () => {
    const { store, data, storage } = setup(); await store.createCollection("existing"); const before = data.get(PERSONAL_LIBRARY_KEY);
    const broken = new PersonalLibrary({ ...storage, set: async () => { throw Error("quota"); } }); await expect(broken.createCollection("new")).rejects.toThrow("quota"); expect(data.get(PERSONAL_LIBRARY_KEY)).toBe(before);
  });
  it("rejects wrong league identity, unknown names and collection/view limits", async () => {
    const { store } = setup(); const c = (await store.createCollection("one")).collections[0]!;
    await expect(store.setPlayer(c.id, { league: "MLB", playerId: player }, true)).rejects.toThrow();
    await expect(store.createCollection(" ")).rejects.toThrow();
    for (let i = 0; i < 19; i++) await store.createCollection(String(i)); await expect(store.createCollection("overflow")).rejects.toThrow("20");
    for (let i = 0; i < 20; i++) await store.saveView(String(i), "NPB", "data", new URLSearchParams()); await expect(store.saveView("overflow", "NPB", "data", new URLSearchParams())).rejects.toThrow("20");
  });
});
