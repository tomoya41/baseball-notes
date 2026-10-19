import { expect, it, vi } from "vitest";
import { createNpbApiReadCache } from "../src/application/npb-api-read-cache";
const headers = { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=300" };
it("coalesces a burst into one read, returns independent bodies and expires without changing saved as-of data", async () => {
  let time = 0; const c = createNpbApiReadCache(() => time);
  const load = vi.fn(async () => new Response(JSON.stringify({ asOf: "2026-10-08", value: 7 }), { headers }));
  const responses = await Promise.all(Array.from({ length: 50 }, () => c.read("game:a", headers, load)));
  expect(load).toHaveBeenCalledTimes(1);
  expect(await Promise.all(responses.map(r => r.json()))).toEqual(Array.from({ length: 50 }, () => ({ asOf: "2026-10-08", value: 7 })));
  await c.read("game:a", headers, load); expect(load).toHaveBeenCalledTimes(1);
  await c.read("game:b", headers, load); expect(load).toHaveBeenCalledTimes(2);
  time = 30_001; await c.read("game:a", headers, load); expect(load).toHaveBeenCalledTimes(3);
});
it("backs off only an explicit read block, preserves previously valid cached values and probes again after the deadline", async () => {
  let time = 0; const c = createNpbApiReadCache(() => time), load = vi.fn(async () => new Response("{}", { headers }));
  await c.read("saved", headers, load);
  const failed = await c.read("blocked", headers, async () => c.failure(Error("BLOCKED: SQL read operations are forbidden (secret)"), "unavailable", headers));
  expect(failed.status).toBe(503); expect(failed.headers.get("Cache-Control")).toBe("no-store"); expect(await failed.text()).not.toContain("secret");
  expect((await c.read("saved", headers, load)).status).toBe(200);
  const other = await c.read("other", headers, load); expect(other.status).toBe(503); expect(other.headers.get("Retry-After")).toBe("30"); expect(load).toHaveBeenCalledTimes(1);
  time = 30_001; expect((await c.read("other", headers, load)).status).toBe(200); expect(load).toHaveBeenCalledTimes(2);
});
it("never caches error results or converts ordinary failures into a global block", async () => {
  const c = createNpbApiReadCache();
  const failed = vi.fn(async () => { throw Error("network"); });
  expect((await c.read("bad", headers, failed)).status).toBe(503);
  expect((await c.read("bad", headers, failed)).status).toBe(503); expect(failed).toHaveBeenCalledTimes(2);
  const good = await c.read("good", headers, async () => new Response("{}", { headers })); expect(good.status).toBe(200);
  const absent = await c.read("absent", headers, async () => new Response("{}", { status: 404, headers }));
  expect(absent.headers.get("Cache-Control")).toBe("no-store");
});
it("bounds entry count and concurrent distinct DB work instead of creating an unbounded query cache", async () => {
  const c = createNpbApiReadCache(); const load = vi.fn(async () => new Response("{}", { headers }));
  for (let i = 0; i < 33; i++) await c.read(String(i), headers, load);
  await c.read("0", headers, load); expect(load).toHaveBeenCalledTimes(34);
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  const requests = Array.from({ length: 32 }, (_, i) => c.read(`pending:${i}`, headers, async () => { await gate; return new Response("{}"); }));
  expect((await c.read("overflow", headers, load)).status).toBe(503); release(); await Promise.all(requests);
});
