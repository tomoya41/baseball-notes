import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { buildWebOffline, retireWebOffline } from "../scripts/build-web-offline";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(p => {
  if (dirname(resolve(p)) !== resolve(tmpdir()) || !basename(p).startsWith("baseball-shell-")) throw Error("Unexpected test cleanup path");
  return rm(p, { recursive: true, force: true });
})); });
const scope = "https://example.test/baseball-notes/";
async function fixture(label = "first") {
  const root = await mkdtemp(join(tmpdir(), "baseball-shell-")); directories.push(root);
  await mkdir(join(root, "assets")); await mkdir(join(root, "icons")); await mkdir(join(root, "data"));
  for (const [name, body] of Object.entries({ "index.html": `<html>${label}</html>`, "manifest.webmanifest": "{}", "assets/index-abc.js": `entry:${label}`, "assets/lazy-def.js": `lazy:${label}`, "assets/app-abc.css": "body{}", "icons/baseball-notes-192.png": "icon1", "icons/baseball-notes-512.png": "icon2", "icons/baseball-notes-maskable-512.png": "icon3", "data/private.json": "DO NOT CACHE", "assets/private.json": "DO NOT CACHE" })) await writeFile(join(root, name), body);
  const build = await buildWebOffline(root);
  return { root, build, worker: await readFile(join(root, "sw.js"), "utf8") };
}
type TaskEvent = { request?: { method: string; url: string; mode: string }; data?: unknown; waitUntil: (task: Promise<unknown>) => void; respondWith: (task: Promise<Response>) => void };
function harness(worker: string, root: string, shared = new Map<string, Map<string, Response>>()) {
  const listeners = new Map<string, (event: TaskEvent) => void>(), claim = vi.fn(), skipWaiting = vi.fn(), unregister = vi.fn();
  const request = vi.fn(async (input: string | { url: string }) => new Response(await readFile(join(root, new URL(typeof input === "string" ? input : input.url).pathname.slice("/baseball-notes/".length)))));
  const caches = { keys: async () => [...shared.keys()], delete: async (name: string) => shared.delete(name), open: async (name: string) => {
    if (!shared.has(name)) shared.set(name, new Map()); const cache = shared.get(name)!;
    return { put: async (url: string, r: Response) => { cache.set(url, r.clone()); }, match: async (url: string) => cache.get(url)?.clone() };
  } };
  runInNewContext(worker, { self: { registration: { scope, unregister }, clients: { claim }, skipWaiting, addEventListener: (name: string, listener: (e: TaskEvent) => void) => listeners.set(name, listener) }, caches, fetch: request, crypto: webcrypto, URL, Response, Uint8Array, AbortSignal });
  async function dispatch(type: string, extra: Partial<TaskEvent> = {}) {
    const tasks: Promise<unknown>[] = []; let response: Promise<Response> | undefined;
    listeners.get(type)?.({ waitUntil: task => tasks.push(task), respondWith: task => { response = task; }, ...extra });
    await Promise.all(tasks); return response;
  }
  const get = (path: string, mode = "cors", method = "GET") => dispatch("fetch", { request: { url: new URL(path, scope).href, mode, method } });
  return { shared, claim, skipWaiting, unregister, request, dispatch, get };
}

describe("bounded versioned Web offline app", () => {
  it("installs the complete shell including lazy routes, reloads the same version offline, and never stores data", async () => {
    const f = await fixture(), h = harness(f.worker, f.root);
    await h.dispatch("install"); expect(h.skipWaiting).not.toHaveBeenCalled(); await h.dispatch("activate");
    h.request.mockClear().mockRejectedValue(Error("Offline"));
    expect(await (await h.get("", "navigate"))!.text()).toContain("first");
    expect(await (await h.get("assets/lazy-def.js"))!.text()).toBe("lazy:first");
    for (const path of ["data/private.json", "api/recent", "assets/private.json", "sw.js", "https://other.test/assets/index-abc.js", "../another-app/", "unknown", "assets/index-abc.js?different=1"]) expect(await h.get(path)).toBeUndefined();
    expect(await h.get("assets/index-abc.js", "cors", "POST")).toBeUndefined(); expect(h.request).not.toHaveBeenCalled();
    expect([...h.shared.values()].flatMap(c => [...c.keys()]).every(p => !p.includes("/data/") && !p.includes("/api/"))).toBe(true);
  });
  it("rejects mixed deployment files and leaves a previous good shell intact", async () => {
    const a = await fixture(), old = harness(a.worker, a.root); await old.dispatch("install");
    const b = await fixture("second"), next = harness(b.worker, b.root, old.shared);
    await writeFile(join(b.root, "assets/lazy-def.js"), "wrong file");
    await expect(next.dispatch("install")).rejects.toThrow("incomplete"); expect(next.shared.size).toBe(1);
    old.request.mockRejectedValue(Error("Offline")); expect(await (await old.get("", "navigate"))!.text()).toContain("first");
  });
  it("activates on explicit request and bounds old shells without deleting another app cache", async () => {
    const a = await fixture(), old = harness(a.worker, a.root); await old.dispatch("install");
    const oldKey = [...old.shared.keys()][0]!; old.shared.set(oldKey.replace(/[^:]+$/, "obsolete"), new Map()); old.shared.set("another-app", new Map());
    const b = await fixture("second"), next = harness(b.worker, b.root, old.shared); await next.dispatch("install");
    expect(next.skipWaiting).not.toHaveBeenCalled(); await next.dispatch("message", { data: { type: "unrelated" } }); expect(next.skipWaiting).not.toHaveBeenCalled();
    await next.dispatch("message", { data: { type: "ACTIVATE_WEB_UPDATE" } }); expect(next.skipWaiting).toHaveBeenCalledOnce(); await next.dispatch("activate");
    expect(next.claim).toHaveBeenCalledOnce(); expect(next.shared.size).toBe(3); expect(next.shared.has("another-app")).toBe(true);
    expect(await (await next.get("", "navigate"))!.text()).toContain("second");
  });
  it("fails safely after storage eviction and recovers online without returning stale baseball JSON", async () => {
    const f = await fixture(), h = harness(f.worker, f.root); await h.dispatch("install");
    h.shared.clear(); h.request.mockRejectedValueOnce(Error("Offline"));
    const response = await h.get("", "navigate"); expect(response?.status).toBe(503); expect(await response!.text()).toContain("保存データは変更していません");
    expect(await (await h.get("index.html", "navigate"))!.text()).toContain("first");
    expect(await h.get("data/latest.json")).toBeUndefined();
  });
  it("keeps a previous hashed lazy route available to a tab still running the old app", async () => {
    const a = await fixture(), old = harness(a.worker, a.root); await old.dispatch("install");
    const b = await fixture("second"); await writeFile(join(b.root, "assets/lazy-next.js"), "new route"); await unlink(join(b.root, "assets/lazy-def.js"));
    await buildWebOffline(b.root); const next = harness(await readFile(join(b.root, "sw.js"), "utf8"), b.root, old.shared);
    await next.dispatch("install"); await next.dispatch("activate"); next.request.mockClear().mockRejectedValue(Error("Offline"));
    expect(await (await next.get("assets/lazy-def.js"))!.text()).toBe("lazy:first"); expect(next.request).not.toHaveBeenCalled();
  });
  it("retires only this scope's disposable shell and unregisters without touching personal storage", async () => {
    const f = await fixture(), h = harness(f.worker, f.root); await h.dispatch("install"); h.shared.set("another-app", new Map());
    await retireWebOffline(f.root); const retired = harness(await readFile(join(f.root, "sw.js"), "utf8"), f.root, h.shared);
    await retired.dispatch("install"); await retired.dispatch("activate");
    expect(retired.unregister).toHaveBeenCalledOnce(); expect([...h.shared.keys()]).toEqual(["another-app"]);
  });
});
