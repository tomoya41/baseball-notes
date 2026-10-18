import { webcrypto, createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { eventFixture } from "./fixtures/npb-player-events";
import { createPublicFetch, type CachedResponse } from "../src/infrastructure/public-response-cache";
afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock("../src/data/npb-player-events-release.json"); vi.resetModules(); });
async function reader() {
  vi.stubGlobal("crypto", webcrypto); const d = eventFixture(), body = JSON.stringify(d), hash = createHash("sha256").update(body).digest("hex");
  vi.doMock("../src/data/npb-player-events-release.json", () => ({ default: { sha256: "b".repeat(64), bytes: Buffer.byteLength(body), bodySha256: hash, events: 1, players: 1, sourceRevision: d.source.revision, identityInputSha256: d.identityInputSha256 } }));
  const { readNpbPlayerEvents } = await import("../src/application/npb-player-events-reader"); return { read: readNpbPlayerEvents, body };
}
it("shares only in-flight reads, validates the pin and then permits offline readback", async () => {
  const { read, body } = await reader(), rows = new Map<string, CachedResponse>(); let online = true;
  const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response(body));
  const store = { get: async (key: string) => rows.get(key), put: async (row: CachedResponse) => { rows.set(row.url, row); }, remove: async (key: string) => { rows.delete(key); } };
  const publicFetch = createPublicFetch(store, request, () => online);
  const [a, b] = await Promise.all([read(publicFetch), read(publicFetch)]); expect(a).toEqual(b); expect(request).toHaveBeenCalledTimes(1); expect(rows.size).toBe(1);
  online = false; expect((await read(publicFetch)).events).toEqual(a.events); expect(request).toHaveBeenCalledTimes(1);
});
it("does not cache an invalid payload or a rejected request forever; Retry can reacquire", async () => {
  const { read, body } = await reader(); const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("{invalid")).mockResolvedValueOnce(new Response(body));
  await expect(read(request)).rejects.toThrow(); expect((await read(request)).events).toHaveLength(1); expect(request).toHaveBeenCalledTimes(2);
});
