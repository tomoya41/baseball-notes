import { describe, expect, it } from "vitest";
import { Favorites } from "../src/application/favorites";
import { PersonalLibrary } from "../src/application/personal-library";
import { PersonalWatch } from "../src/application/personal-watch";
import { PersonalBackup } from "../src/application/personal-backup";
import { PERSONAL_KEYS as K, PERSONAL_JOURNAL_KEY as J, PersonalSettingsStore } from "../src/application/personal-settings";
import { emptyWatchState, type WatchObservation } from "../src/domain/personal-watch";
const now = Date.parse("2026-10-29T01:00:00Z"), id = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
const npb = { league: "NPB", kind: "player", entityId: id } as const;
const mlb = { league: "MLB", kind: "player", entityId: `mlb:player:${id}` } as const;
function setup() {
  const data = new Map<string, string>(); let time = now, n = 0;
  const raw = { get: async (key: string) => data.get(key) ?? null, set: async (key: string, value: string) => { data.set(key, value); }, remove: async (key: string) => { data.delete(key); } };
  const store = new PersonalSettingsStore(raw), clock = () => time, backup = new PersonalBackup(store, clock);
  return { data, raw, store, backup, clock, advance: (ms: number) => { time += ms; }, favorites: new Favorites(store, clock), library: new PersonalLibrary(store, clock, () => `item-${++n}`), watch: new PersonalWatch(store, clock) };
}
async function populated() {
  const s = setup(); await s.favorites.add(npb); await s.favorites.add(mlb);
  const c = (await s.library.createCollection("移行する選手")).collections[0]!;
  await s.library.setPlayer(c.id, { league: "NPB", playerId: id }, true);
  await s.library.saveView("秋の比較", "MLB", "data", new URLSearchParams("season=2025&competition=postseason&metric1=HR&value1=2&q=明示保存"));
  await s.library.visit({ league: "NPB", kind: "players", entityId: id, conditions: "season=2026", visitedAt: now });
  await s.watch.preference("recent", true); return s;
}
async function signed(edit: (file: Record<string, unknown>) => void) {
  const s = await populated(), file = JSON.parse((await s.backup.export()).text); edit(file); delete file.checksum;
  file.checksum = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(file)))).toString("hex"); return JSON.stringify(file);
}
const observation: WatchObservation = { key: "streak", league: "MLB", kind: "player", entityId: mlb.entityId, name: "選手", rule: "streak", season: 2025, competition: "regular", effectiveDate: "2025-09-28", generatedAt: null, eventDate: null, coverage: "complete", path: `/MLB/players/${mlb.entityId}`, metric: "安打", values: { value: 4, atLeast: "false" }, collectionOnly: false, observedAt: now };
describe("portable personal backup", () => {
  it("round-trips selections into a different empty environment, preserving IDs, scopes and existing URLs", async () => {
    const source = await populated(), target = setup(), { text, filename } = await source.backup.export();
    expect(filename).toBe("baseball-notes-backup-2026-10-29.json");
    const preview = await target.backup.preview(text, "replace"); expect(preview.before.favorites).toBe(0); expect(preview.after).toEqual({ favorites: 2, collections: 1, views: 1, activity: 1 });
    expect(target.data.size).toBe(0); await target.backup.restore(preview.token);
    expect(await target.favorites.list()).toEqual(await source.favorites.list()); expect(await target.library.read()).toEqual(await source.library.read());
    expect((await target.watch.read()).preferences.recent).toBe(true); expect(target.data.has(J)).toBe(false);
    expect((await target.library.read()).views[0]!.conditions).toContain("competition=postseason");
  });
  it("exports only personal selections, excluding Watch numbers, alerts, tokens, caches and appearance", async () => {
    const s = await populated(); await s.watch.observe([observation]); await s.watch.observe([{ ...observation, values: { value: 0, atLeast: "false" } }]);
    expect((await s.watch.read()).alerts).toHaveLength(1); s.data.set("appearance-v1", "private-appearance"); s.data.set("api-token", "secret-not-exported");
    const file = JSON.parse((await s.backup.export()).text); expect(Object.keys(file.data)).toEqual(["favorites", "library", "watch"]);
    expect(JSON.stringify(file)).not.toMatch(/observations|alerts|checkedAt|private-appearance|secret-not-exported|atLeast/);
  });
  it("merges without duplicate content, handles same local ID for different content, and is idempotent", async () => {
    const source = await populated(), target = setup(); await target.favorites.add(npb);
    await target.library.createCollection("端末に元からある別の集合"); await target.library.saveView("別条件", "NPB", "history", new URLSearchParams("season=2020"));
    const text = (await source.backup.export()).text;
    for (let n = 0; n < 2; n++) { const p = await target.backup.preview(text, "merge"); await target.backup.restore(p.token); }
    const result = await target.library.read(); expect(result.collections).toHaveLength(2); expect(result.views).toHaveLength(2);
    expect(new Set(result.collections.map(c => c.id)).size).toBe(2); expect(new Set(result.views.map(c => c.id)).size).toBe(2);
    expect(await target.favorites.list()).toHaveLength(2); expect((await target.watch.read()).preferences.recent).toBe(false);
  });
  it("merges members for a shared collection and preserves both leagues", async () => {
    const source = await populated(), target = await populated(), c = (await target.library.read()).collections[0]!;
    await target.library.setPlayer(c.id, { league: "MLB", playerId: mlb.entityId }, true);
    const p = await target.backup.preview((await source.backup.export()).text, "merge"); await target.backup.restore(p.token);
    expect((await target.library.read()).collections).toHaveLength(1); expect((await target.library.read()).collections[0]!.players).toHaveLength(2);
  });
  it("keeps destination alert history/read tombstones and establishes a fresh baseline without replay", async () => {
    const source = await populated(), target = setup(); await target.watch.observe([observation]); await target.watch.observe([{ ...observation, values: { value: 0, atLeast: "false" } }]); await target.watch.markRead();
    const before = await target.watch.read(), p = await target.backup.preview((await source.backup.export()).text, "replace"); await target.backup.restore(p.token);
    const after = await target.watch.read(); expect(after.observations).toEqual([]); expect(after.checkedAt).toBeNull(); expect(after.alerts).toEqual(before.alerts); expect(after.seen).toEqual(before.seen);
    await target.watch.observe([observation]); expect((await target.watch.read()).alerts).toEqual(before.alerts);
  });
  it.each(["checksum", "version", "extra", "wrong-league", "duplicate", "future", "query", "invalid-series"])("rejects %s without writing or retaining a usable preview", async kind => {
    const source = await populated(), target = setup(), file = JSON.parse((await source.backup.export()).text);
    if (kind === "checksum") file.data.favorites.pop();
    const text = kind === "checksum" ? JSON.stringify(file) : await signed(f => {
      if (kind === "version") f.version = 99;
      if (kind === "extra") f.statistics = { H: 42 };
      const data = f.data as typeof file.data;
      if (kind === "wrong-league") data.favorites[0].entityId = mlb.entityId;
      if (kind === "duplicate") data.favorites.push(data.favorites[0]);
      if (kind === "future") data.library.collections[0].updatedAt = now + 86400000;
      if (kind === "query") data.library.views[0].conditions = "secret=token";
      if (kind === "invalid-series") data.library.activity[0] = { league: "NPB", kind: "series", entityId: "npb:series:invalid", conditions: "", visitedAt: now };
    });
    await expect(target.backup.preview(text, "merge")).rejects.toThrow(); expect(target.data.size).toBe(0);
  });
  it("rejects oversize UTF-8, unsupported JSON and a changed backing store", async () => {
    const source = await populated(), target = setup(); await expect(target.backup.preview("あ".repeat(333334), "merge")).rejects.toThrow("1MB");
    await expect(target.backup.preview("not-json", "merge")).rejects.toThrow("形式");
    const p = await target.backup.preview((await source.backup.export()).text, "replace"); await target.favorites.add({ ...npb, entityId: other });
    const before = new Map(target.data); await expect(target.backup.restore(p.token)).rejects.toThrow("変更"); expect(target.data).toEqual(before);
  });
  it("expires or cancels a preview, rejects token reuse and older preview tokens", async () => {
    const source = await populated(), target = setup(), text = (await source.backup.export()).text;
    let p = await target.backup.preview(text, "merge"); target.backup.cancel(); await expect(target.backup.restore(p.token)).rejects.toThrow("期限");
    p = await target.backup.preview(text, "merge"); target.advance(300001); await expect(target.backup.restore(p.token)).rejects.toThrow("期限");
    p = await target.backup.preview(text, "merge"); const latest = await target.backup.preview(text, "replace"); await expect(target.backup.restore(p.token)).rejects.toThrow();
    const q = await target.backup.preview(text, "replace"); await target.backup.restore(q.token); await expect(target.backup.restore(q.token)).rejects.toThrow(); expect(latest.mode).toBe("replace");
  });
  it("drops only expired activity, deduplicates newer history and fails safely over collection limits", async () => {
    const source = await populated(), target = setup(); source.advance(91 * 86400000); target.advance(91 * 86400000);
    const text = (await source.backup.export()).text, p = await target.backup.preview(text, "merge"); expect(p.after.activity).toBe(0);
    for (let n = 0; n < 20; n++) await target.library.createCollection(`別${n}`);
    const before = new Map(target.data); await expect(target.backup.preview(text, "merge")).rejects.toThrow("上限"); expect(target.data).toEqual(before);
  });
  it("serializes restore with ordinary edits rather than losing favorites or overwriting a changed preview", async () => {
    const source = await populated(), target = setup(), p = await target.backup.preview((await source.backup.export()).text, "replace");
    await Promise.all([target.backup.restore(p.token), target.favorites.add({ ...npb, entityId: other }), target.library.createCollection("後の編集")]);
    expect(await target.favorites.list()).toHaveLength(3); expect((await target.library.read()).collections).toHaveLength(2);
  });
});

describe("atomic multi-key personal restore", () => {
  const keys = Object.values(K);
  it.each([1, 2, 3, 4, 5, 6])("survives interruption/failure at write %i and recovers a coherent old/new state", async failAt => {
    const data = new Map<string, string>(keys.map(k => [k, `old:${k}`])); data.set("unrelated", "untouched"); let writes = 0, stopped = false;
    const raw = { get: async (k: string) => data.get(k) ?? null, set: async (k: string, v: string) => { if (stopped || ++writes === failAt) { stopped = true; throw Error("power loss"); } data.set(k, v); }, remove: async (k: string) => { if (stopped || ++writes === failAt) { stopped = true; throw Error("power loss"); } data.delete(k); } };
    const store = new PersonalSettingsStore(raw); const result = await store.transaction(async v => { for (const k of keys) await v.set(k, `new:${k}`); }, true).then(() => "new", () => "old");
    const restarted = new PersonalSettingsStore(raw);
    expect(await Promise.all(keys.map(k => restarted.get(k)))).toEqual(keys.map(k => `${result}:${k}`)); expect(data.get("unrelated")).toBe("untouched");
    stopped = false; writes = 100; await restarted.set(keys[0]!, "edited"); expect(data.has(J)).toBe(false);
    expect(keys.slice(1).map(k => data.get(k))).toEqual(keys.slice(1).map(k => `${result}:${k}`));
  });
  it("serves complete old values when missing original keys cannot yet be physically rolled back", async () => {
    const s = setup(); let writes = 0, broken = false;
    const raw = { ...s.raw, set: async (k: string, v: string) => { if (broken || ++writes === 3) { broken = true; throw Error("quota"); } s.data.set(k, v); }, remove: async (k: string) => { if (broken) throw Error("quota"); s.data.delete(k); } };
    const store = new PersonalSettingsStore(raw); await expect(store.transaction(async v => { for (const k of keys) await v.set(k, "new"); }, true)).rejects.toThrow();
    expect(await Promise.all(keys.map(k => store.get(k)))).toEqual([null, null, null]); broken = false; writes = 100;
    await store.set(keys[2]!, "later"); expect(s.data.has(keys[0]!)).toBe(false); expect(s.data.has(keys[1]!)).toBe(false);
  });
  it("recognizes an acknowledged-late commit and leaves the complete new state", async () => {
    const s = setup(), raw = { ...s.raw, set: async (k: string, v: string) => { s.data.set(k, v); if (k === J && JSON.parse(v).phase === "committed") throw Error("late ack"); } };
    const store = new PersonalSettingsStore(raw); await store.transaction(async v => { for (const k of keys) await v.set(k, "new"); }, true);
    expect(await Promise.all(keys.map(k => store.get(k)))).toEqual(["new", "new", "new"]);
  });
  it("never resets a corrupt journal or touches unrelated keys", async () => {
    const s = setup(); s.data.set(J, "broken"); const before = new Map(s.data);
    await expect(s.store.get(K.favorites)).rejects.toThrow("保持"); await expect(s.favorites.add(npb)).rejects.toThrow(); expect(s.data).toEqual(before);
    s.data.delete(J); await expect(s.store.set("secrets", "no")).rejects.toThrow(); expect(s.data.size).toBe(0); await s.favorites.add(npb); expect(await s.favorites.list()).toHaveLength(1);
  });
  it("fails before the first write if a noncooperative old client changed a read key", async () => {
    const s = setup(); await expect(s.store.transaction(async v => { await v.set(K.favorites, "new"); s.data.set(K.favorites, "external"); })).rejects.toThrow("変更"); expect(s.data.get(K.favorites)).toBe("external");
  });
  it("does not expose a mutable snapshot or journal normal single-key edits", async () => {
    const s = setup(); await expect(s.store.snapshot(v => v.set(K.favorites, "no"))).rejects.toThrow();
    await s.favorites.add(npb); expect(s.data.has(J)).toBe(false); expect(await s.favorites.list()).toHaveLength(1);
    expect(emptyWatchState().alerts).toEqual([]);
  });
});
