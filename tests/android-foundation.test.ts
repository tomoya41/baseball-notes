import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import { eodNotification, favoriteNotificationTopics } from "../src/domain/eod-notifications";
import { FavoriteNotifications, type NotificationPort } from "../src/application/favorite-notifications";
import { PublicResponseStore, createPublicFetch, rememberPublicResponse } from "../src/infrastructure/public-response-cache";
import { sendPublishedEodNotifications } from "../src/data/eod-notification-producer";
import { openDataClient, migrateData } from "../src/data/database";
import { eodEvent } from "../src/data/npb-eod";
import type { Favorite } from "../src/domain/models";
const id = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
const mlb = "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f";
const fav = (entityId: string, league: "NPB" | "MLB" = "NPB"): Favorite => ({ entityId, league, kind: "player", addedAt: "2026-09-30T00:00:00Z" });
describe("canonical native navigation", () => {
  it.each([`baseballnotes://NPB/players/${id}`, `https://tomoya41.github.io/baseball-notes/#/NPB/players/${id}`,
    `https://tomoya41.github.io/baseball-notes/NPB/players/${id}`])("translates %s without provider IDs", uri => {
    expect(canonicalDeepLink(uri)).toBe(`/NPB/players/${id}`);
  });
  it("retains historical context and encoded canonical IDs", () => {
    expect(canonicalDeepLink(`baseballnotes://MLB/players/${encodeURIComponent(mlb)}/analysis?season=2025&date=2025-09-20&token=bad`))
      .toBe(`/MLB/players/${encodeURIComponent(mlb)}/analysis?season=2025&date=2025-09-20`);
  });
  it("drops impossible calendar dates while retaining a valid leap day", () => {
    expect(canonicalDeepLink(`baseballnotes://MLB/players/${encodeURIComponent(mlb)}/analysis?season=2025&date=2025-02-30&asOfDate=2025-99-01`))
      .toBe(`/MLB/players/${encodeURIComponent(mlb)}/analysis?season=2025`);
    expect(canonicalDeepLink(`baseballnotes://MLB/players/${encodeURIComponent(mlb)}?date=2024-02-29`))
      .toBe(`/MLB/players/${encodeURIComponent(mlb)}?date=2024-02-29`);
  });
  it.each(["https://evil.test/#/NPB/players/123", "javascript:alert(1)", "baseballnotes://NPB/players/123", `baseballnotes://MLB/players/${id}`,
    `https://tomoya41.github.io/other/#/NPB/players/${id}`, `baseballnotes://NPB/players/${id}/admin`])("rejects %s", uri => expect(canonicalDeepLink(uri)).toBeNull());
  it("uses parent screens only when no router history exists", () => {
    expect(parentNativeRoute(`/MLB/players/${mlb}/analysis`)).toBe(`/MLB/players/${mlb}`);
    expect(parentNativeRoute("/NPB/games/npb:game:abc")).toBe("/NPB/schedule");
    for (const screen of ["my", "records", "analysis", "schedule"]) expect(parentNativeRoute(`/NPB/${screen}`)).toBe("/NPB/home");
    expect(parentNativeRoute("/MLB/home")).toBeNull();
  });
});
describe("validated persistent response cache", () => {
  it("never caches or deduplicates a Request carrying POST", async () => {
    const store = new PublicResponseStore("qa-cache-post"), request = vi.fn<typeof fetch>().mockImplementation(async () => new Response("ok"));
    const fetcher = createPublicFetch(store, request, () => true);
    const input = new Request("https://public.test/action", { method: "POST" });
    await Promise.all([fetcher(input), fetcher(input)]);
    expect(request).toHaveBeenCalledTimes(2); expect(await store.get(input.url)).toBeUndefined();
  });
  it("preserves valid data across store instances and offline without turning null/zero into estimates", async () => {
    const store = new PublicResponseStore("qa-cache-restart"), request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"PA":0,"SF":null}'));
    let network = true;
    const fetcher = createPublicFetch(store, request, () => network);
    const response = await fetcher("https://public.test/data/players.json");
    expect(await response.json()).toEqual({ PA: 0, SF: null }); await rememberPublicResponse(response);
    network = false;
    const restarted = createPublicFetch(new PublicResponseStore("qa-cache-restart"), request, () => network);
    expect(await (await restarted("https://public.test/data/players.json")).json()).toEqual({ PA: 0, SF: null });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not replace the last validated payload with unvalidated response or HTTP errors", async () => {
    const store = new PublicResponseStore("qa-cache-validation");
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{"valid":1}')).mockResolvedValueOnce(new Response('{"wrongIdentity":true}'))
      .mockResolvedValueOnce(new Response("failure", { status: 503 }));
    const fetcher = createPublicFetch(store, request, () => true), good = await fetcher("https://public.test/a");
    await rememberPublicResponse(good); await fetcher("https://public.test/a");
    expect(await (await fetcher("https://public.test/a")).json()).toEqual({ valid: 1 });
  });
  it("handles first-launch offline and authoritative 404 without fabricated data", async () => {
    const store = new PublicResponseStore("qa-cache-empty");
    await expect(createPublicFetch(store, fetch, () => false)("https://public.test/a")).rejects.toThrow("Offline");
    const fetcher = createPublicFetch(store, vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })), () => true);
    expect((await fetcher("https://public.test/a")).status).toBe(404); expect(await store.get("https://public.test/a")).toBeUndefined();
  });
  it("bounds cache bytes and excludes oversized payloads", async () => {
    const store = new PublicResponseStore("qa-cache-bounds", 6);
    const row = (url: string, bytes: number, savedAt: number) => ({ url, bytes, savedAt, body: new ArrayBuffer(bytes), contentType: "application/json" });
    await store.put(row("old", 4, 1)); await store.put(row("new", 4, 2));
    expect(await store.get("old")).toBeUndefined(); expect(await store.get("new")).toBeDefined();
    await store.put(row("huge", 2 * 1024 * 1024 + 1, 3)); expect(await store.get("huge")).toBeUndefined();
  });
  it("deduplicates same-run HTTP without sharing a consumed response body", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => { await Promise.resolve(); return new Response('{"a":1}'); });
    const fetcher = createPublicFetch(new PublicResponseStore("qa-cache-dedupe"), request, () => true);
    const results = await Promise.all([fetcher("https://public.test/a"), fetcher("https://public.test/a")]);
    expect(await Promise.all(results.map(r => r.json()))).toEqual([{ a: 1 }, { a: 1 }]); expect(request).toHaveBeenCalledTimes(1);
  });
});
describe("opt-in favorite notification subscriptions", () => {
  function setup(granted = true) {
    const values = new Map<string, string>();
    const port: NotificationPort = { status: vi.fn().mockResolvedValue({ configured: true, granted }), enable: vi.fn().mockResolvedValue({ granted }),
      disable: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn().mockResolvedValue(undefined), unsubscribe: vi.fn().mockResolvedValue(undefined) };
    return { values, port, service: new FavoriteNotifications({ get: async key => values.get(key) ?? null, set: async (k, v) => { values.set(k, v); } }, port) };
  }
  it("defaults OFF and does not request permission on startup", async () => {
    const { service, port } = setup(); await service.sync([fav(id)]);
    expect(await service.enabled()).toBe(false); expect(port.enable).not.toHaveBeenCalled(); expect(port.subscribe).not.toHaveBeenCalled();
  });
  it("subscribes/unsubscribes only canonical NPB players, retaining local favorites", async () => {
    const { service, port } = setup(); const favorites = [fav(id), fav(mlb, "MLB"), fav(id), fav("broken")];
    expect(favoriteNotificationTopics(favorites)).toEqual([`npb-player-${id}`]);
    await service.setEnabled(true, favorites); await service.sync(favorites);
    expect(port.subscribe).toHaveBeenCalledTimes(1); await service.sync([fav(other)]);
    expect(port.unsubscribe).toHaveBeenCalledWith({ topic: `npb-player-${id}` });
    await service.setEnabled(false, [fav(other)]); expect(port.disable).toHaveBeenCalled(); expect(favorites).toHaveLength(4);
  });
  it("denied permission and missing Firebase do not turn ON", async () => {
    const { service, port } = setup(false); await expect(service.setEnabled(true, [fav(id)])).rejects.toThrow("許可");
    expect(await service.enabled()).toBe(false); vi.mocked(port.status).mockResolvedValue({ configured: false, granted: false });
    await expect(service.setEnabled(true, [fav(id)])).rejects.toThrow("準備");
  });
  it("keeps failed topic mutations pending and retries on reconnect", async () => {
    const { service, port } = setup(); vi.mocked(port.subscribe).mockRejectedValueOnce(Error("offline"));
    await expect(service.setEnabled(true, [fav(id)])).rejects.toThrow("offline"); await service.sync([fav(id)]);
    expect(port.subscribe).toHaveBeenCalledTimes(2);
  });
  it("removes an uncertain subscription after restart even when it never reached the confirmed ledger", async () => {
    const { service, values, port } = setup(); vi.mocked(port.subscribe).mockRejectedValueOnce(Error("offline uncertain"));
    await expect(service.setEnabled(true, [fav(id)])).rejects.toThrow("uncertain");
    const restarted = new FavoriteNotifications({ get: async k => values.get(k) ?? null, set: async (k,v) => { values.set(k,v); } }, port);
    await restarted.sync([]); expect(port.unsubscribe).toHaveBeenCalledWith({ topic: `npb-player-${id}` });
    expect(values.get("baseball:notifications:pending")).toBe("[]");
  });
  it("reconciles pending unsubscribe when the user favorites that player again", async () => {
    const { service, values, port } = setup(); await service.setEnabled(true, [fav(id)]);
    vi.mocked(port.unsubscribe).mockRejectedValueOnce(Error("uncertain unsubscribe"));
    await expect(service.sync([])).rejects.toThrow("uncertain"); await service.sync([fav(id)]);
    expect(port.subscribe).toHaveBeenCalledTimes(2); expect(values.get("baseball:notifications:pending")).toBe("[]");
  });
  it("bounds an offline SDK wait without losing the pending subscription", async () => {
    vi.useFakeTimers();
    try {
      const { values, port } = setup(); vi.mocked(port.subscribe).mockImplementationOnce(() => new Promise(() => undefined));
      const service = new FavoriteNotifications({ get: async k => values.get(k) ?? null, set: async (k,v) => { values.set(k,v); } }, port, 100);
      const pending = expect(service.setEnabled(true, [fav(id)])).rejects.toThrow("通信");
      await vi.advanceTimersByTimeAsync(100); await pending;
      await service.sync([fav(id)]); expect(port.subscribe).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it("generates non-evaluative EOD content and canonical deep link", () => {
    const event = eodNotification("2026-09-30", id, "中島大輔");
    expect(event.id).toContain(`2026-09-30:${id}`); expect(event.title).toBe("中島大輔の成績が更新されました");
    expect(canonicalDeepLink(event.deepLink)).toBe(`/NPB/players/${id}`);
  });
});
it("producer requires verified publication and isolates uncertain sends with an at-most-once ledger", async () => {
  const client = openDataClient("file::memory:"); await migrateData(client);
  const directory = { schemaVersion: 2, league: "NPB", effectiveDate: "2026-09-30", generatedAt: "2026-09-30T00:00:00Z",
    teams: Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: String(i), shortName: String(i) })),
    players: [{ playerId: id, displayName: "選手", teamId: "0", position: null, playerType: null, birthDate: null, birthPlace: null, nationality: null,
      bats: null, throws: null, battingAvailable: true, pitchingAvailable: false, recentAvailable: true }] };
  try {
    const send = vi.fn().mockRejectedValue(Error("network uncertain"));
    await expect(sendPublishedEodNotifications(client, "2026-09-30", directory, send)).rejects.toThrow("publication");
    await eodEvent(client, "eod-published", "2026-09-30", {});
    // A minimal Game participant fixture is sufficient; the producer never changes Fact values.
    await client.execute("DROP TABLE npb_games"); await client.execute("CREATE TABLE npb_games(game_id TEXT, game_date TEXT)");
    await client.execute("DROP TABLE player_game_batting"); await client.execute("CREATE TABLE player_game_batting(game_id TEXT, player_id TEXT)");
    await client.execute("INSERT INTO npb_games VALUES ('game','2026-09-30')");
    await client.execute({ sql: "INSERT INTO player_game_batting VALUES ('game',?)", args: [id] });
    expect(await sendPublishedEodNotifications(client, "2026-09-30", directory, send)).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(await sendPublishedEodNotifications(client, "2026-09-30", directory, send)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  } finally { client.close(); }
});
it("native project and workflows retain safety schedules, no secrets or placeholder App Links", () => {
  const workflow = parse(readFileSync(".github/workflows/android-beta.yml", "utf8")); expect(workflow.jobs.build).toBeDefined();
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  expect(manifest).toContain('android:scheme="baseballnotes"'); expect(manifest).toContain('android:value="false"');
  for (const name of ["daily-collector", "npb-eod-watcher"]) {
    const steps = parse(readFileSync(`.github/workflows/${name}.yml`, "utf8")).jobs.deploy.steps;
    const mark = steps.findIndex((s: { run?: string }) => s.run?.includes("mark-published"));
    const notify = steps.findIndex((s: { run?: string }) => s.run?.includes("send-eod-notifications"));
    expect(notify).toBeGreaterThan(mark); expect(steps[notify]["continue-on-error"]).toBe(true);
    expect(steps[notify]["timeout-minutes"]).toBe(5);
  }
});
